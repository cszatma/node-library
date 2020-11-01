// Copyright (c) 2020 Christopher Szatmary <cs@christopherszatmary.com>
// All rights reserved. MIT License.

import { runtime } from "../_runtime/runtime";

let shouldShowErrDetail = false;

export function showErrDetail(b: boolean): void {
  shouldShowErrDetail = b;
}

/**
 * Logs a message and error to stderr, then terminates the process with code 1.
 * @param err The error to log.
 * @param message The message to log.
 * @param optionalParams Any additional parameters to log.
 */
export function exitErr(err: error, message: string, ...optionalParams: unknown[]): never {
  console.error(message, ...optionalParams);

  if (shouldShowErrDetail) {
    console.error(`Error: ${err.detailedError()}`);
  } else {
    console.error(`Error: ${err.error()}`);
  }

  runtime.exit(1);
}

/**
 * Logs a message to stderr, then terminates the process with code 1.
 * @param message The message to log.
 * @param optionalParams Any additional parameters to log.
 */
export function exit(message: string, ...optionalParams: unknown[]): never {
  console.error(message, ...optionalParams);
  runtime.exit(1);
}
