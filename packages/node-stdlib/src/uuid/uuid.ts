// Copyright (c) 2020 Christopher Szatmary <cs@christopherszatmary.com>
// All rights reserved. MIT License.

/* eslint-disable no-bitwise */

import crypto from "crypto";
import { inspect } from "util";
import { panic } from "../global";
import { Result } from "../core/mod";
import { errorString } from "../errors/mod";

export enum Version {
  nil,
  v1,
  v2,
  v3,
  v4,
  v5,
}

export enum Variant {
  ncs,
  rfc4122,
  microsoft,
  future,
}

const uuidSize = 16;
const versionIndex = 6;
const variantIndex = 8;

function createNameBasedUUID(namespace: Buffer, name: string, version: 3 | 5): Buffer {
  // Section 4.3 describes the algorithm for creating a name based uuid
  // https://tools.ietf.org/html/rfc4122#section-4.3
  // This is used to create v3 and v5 uuids

  // Convert name to bytes and concatenate it with the namespace
  const buf = Buffer.concat([namespace, Buffer.from(name, "utf8")]);

  // Compute the hash of the namespace concatenated with the name
  const algorithm = version === 5 ? "sha1" : "md5";
  const hash = crypto.createHash(algorithm).update(buf).digest();

  // Set version and variant as required
  hash[versionIndex] = (hash[versionIndex] & 0b00001111) | (version << 4);
  hash[variantIndex] = (hash[variantIndex] & 0b00111111) | 0b10000000;

  return hash;
}

/**
 * Represents a RFC 4122 spec compliant UUID.
 * https://tools.ietf.org/html/rfc4122
 */
class UUID {
  #buf: Buffer;

  constructor(buf: Buffer) {
    this.#buf = buf;
  }

  /**
   * Returns a `Buffer` containing the bytes stored in the `UUID`.
   *
   * **Note:** This will return a copy of the bytes to ensure the
   * `UUID` remains immutable.
   */
  bytes(): Buffer {
    const buf = Buffer.alloc(uuidSize);
    this.#buf.copy(buf);
    return buf;
  }

  /**
   * Creates a string representation of the uuid instance.
   *
   * i.e. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  toString(): string {
    return [
      this.#buf.toString("hex", 0, 4),
      "-",
      this.#buf.toString("hex", 4, 6),
      "-",
      this.#buf.toString("hex", 6, 8),
      "-",
      this.#buf.toString("hex", 8, 10),
      "-",
      this.#buf.toString("hex", 10),
    ].join("");
  }

  /**
   * Checks if the current UUID instance is equal to the given UUID instance.
   */
  equals(uuid: UUID): boolean {
    return this.#buf.equals(uuid.#buf);
  }

  /**
   * Returns the version of the uuid.
   */
  version(): Version {
    return this.#buf[versionIndex] >> 4;
  }

  /**
   * Returns the layout variant of the uuid.
   */
  variant(): Variant {
    const variantOctet = this.#buf[variantIndex];
    if (variantOctet >> 7 === 0) {
      return Variant.ncs;
    } else if (variantOctet >> 6 === 0b10) {
      return Variant.rfc4122;
    } else if (variantOctet >> 5 === 0b110) {
      return Variant.microsoft;
    }

    return Variant.future;
  }

  /**
   * Custom inspect implementation for use with node's `util.inspect`.
   */
  [inspect.custom](depth?: number | null): string {
    if (depth == null || depth < 0) {
      return "UUID {}";
    }

    return `UUID { ${this.toString()} }`;
  }
}

// Only export the type, not the class itself.
export type { UUID };

/**
 * The nil uuid where all bits are set to 0.
 */
export const nil = new UUID(Buffer.alloc(uuidSize));

/**
 * Name space IDs defined in Appendix C.
 * https://tools.ietf.org/html/rfc4122#appendix-C
 */
export const namespaceIDs = Object.freeze({
  /* eslint-disable @typescript-eslint/naming-convention */
  DNS: new UUID(Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex")),
  URL: new UUID(Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex")),
  OID: new UUID(Buffer.from("6ba7b8129dad11d180b400c04fd430c8", "hex")),
  X500: new UUID(Buffer.from("6ba7b8149dad11d180b400c04fd430c8", "hex")),
  /* eslint-enable @typescript-eslint/naming-convention */
});

/* ----- UUID Creation Methods ----- */

/**
 * Creates a RFC 4122 spec compliant v4 uuid.
 */
export function newV4(): UUID {
  // Section 4.4 describes the algorithm for creating a v4 UUID
  // https://tools.ietf.org/html/rfc4122#section-4.4

  // Generate 128 bits of cryptographically strong pseudo-random data
  const rnds = crypto.randomBytes(uuidSize);

  // Octet 6-7 is time_hi_and_version
  // Need to set the 4 most significant bits to the 4-bit version number
  // Version number for v4 is 0100 per 4.1.3
  // https://tools.ietf.org/html/rfc4122#section-4.1.3
  rnds[versionIndex] = (rnds[versionIndex] & 0b00001111) | 0b01000000;

  // Octet 8 is clock_seq_hi_and_reserved
  // Need to set the 2 most significant bits to 1 and 0
  rnds[variantIndex] = (rnds[variantIndex] & 0b00111111) | 0b10000000;

  return new UUID(rnds);
}

/**
 * Creates a RFC 4122 spec compliant v3 uuid.
 */
export function newV3(namespace: UUID, name: string): UUID {
  const hash = createNameBasedUUID(namespace.bytes(), name, 3);
  // v3 uses MD5 which is 16 bytes so no need to modify
  return new UUID(hash);
}

/**
 * Creates a RFC 4122 spec compliant v5 uuid.
 */
export function newV5(namespace: UUID, name: string): UUID {
  const hash = createNameBasedUUID(namespace.bytes(), name, 5);
  // v5 uses SHA1 which creates a 20 byte buffer so we need to trim it
  return new UUID(hash.subarray(0, uuidSize));
}

/**
 * Creates a new UUID instance from the given uuid string.
 * Returns `undefined` the the string is not a valid uuid.
 */
export function fromString(uuidString: string): Result<UUID, error> {
  // uuid strings are 36 chars, 32 hex digits + 4 dashes
  if (uuidString.length !== 36) {
    return Result.failure(errorString(`uuid: incorrect UUID length: ${uuidString}`));
  }

  // Make sure dashes are present at the correct indices
  if (
    uuidString[8] !== "-" ||
    uuidString[13] !== "-" ||
    uuidString[18] !== "-" ||
    uuidString[23] !== "-"
  ) {
    return Result.failure(errorString(`uuid: incorrect UUID format: ${uuidString}`));
  }

  const buf = Buffer.alloc(uuidSize);
  const ranges = [
    [0, 8],
    [9, 13],
    [14, 18],
    [19, 23],
    [24, 36],
  ];
  let offset = 0;

  for (const range of ranges) {
    for (let i = range[0]; i < range[1]; i += 2) {
      const firstDigit = parseInt(uuidString[i], 16);
      const secondDigit = parseInt(uuidString[i + 1], 16);

      // Char was not a valid hex digit
      if (Number.isNaN(firstDigit) || Number.isNaN(secondDigit)) {
        return Result.failure(errorString(`uuid: invalid character in UUID: ${uuidString}`));
      }

      // Combine digits into one byte
      buf[offset] = (firstDigit << 4) | secondDigit;
      offset++;
    }
  }

  const uuid = new UUID(buf);

  // Make sure version is valid
  const version = uuid.version();
  if (version < Version.nil || version > Version.v5) {
    return Result.failure(errorString(`uuid: invalid UUID version: ${uuidString}`));
  }

  return Result.success(uuid);
}

/**
 * `mustFromString` is like `fromString` but panics if an error occurred.
 * This is useful when creating UUIDs from string literals.
 */
export function mustFromString(uuidString: string): UUID {
  const r = fromString(uuidString);
  if (r.isFailure()) {
    panic(r.failure().error());
  }

  return r.success();
}
