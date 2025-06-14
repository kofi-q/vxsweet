/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import { Buffer } from 'node:buffer';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

/**
 * Data of data/electionTwoPartyPrimary/csvFiles/batchResults.csv encoded as base64.
 *
 * SHA-256 hash of file data: 02559dda9dca79d5eda2129b6ee8ee7fa92ab4b1e4331b73e82b2ea4052dd70c
 */
const resourceDataBase64 = 'QmF0Y2ggSUQsQmF0Y2ggTmFtZSxUYWJ1bGF0b3IsTnVtYmVyIG9mIEJhbGxvdHMsIk1hbW1hbCBQYXJ0eSBCZXN0IEFuaW1hbCAtIEJhbGxvdHMgQ2FzdCIsIk1hbW1hbCBQYXJ0eSBCZXN0IEFuaW1hbCAtIFVuZGVydm90ZXMiLCJNYW1tYWwgUGFydHkgQmVzdCBBbmltYWwgLSBPdmVydm90ZXMiLCJNYW1tYWwgUGFydHkgQmVzdCBBbmltYWwgLSBIb3JzZSIsIk1hbW1hbCBQYXJ0eSBCZXN0IEFuaW1hbCAtIE90dGVyIiwiTWFtbWFsIFBhcnR5IEJlc3QgQW5pbWFsIC0gRm94IiwiRmlzaCBQYXJ0eSBCZXN0IEFuaW1hbCAtIEJhbGxvdHMgQ2FzdCIsIkZpc2ggUGFydHkgQmVzdCBBbmltYWwgLSBVbmRlcnZvdGVzIiwiRmlzaCBQYXJ0eSBCZXN0IEFuaW1hbCAtIE92ZXJ2b3RlcyIsIkZpc2ggUGFydHkgQmVzdCBBbmltYWwgLSBTZWFob3JzZSIsIkZpc2ggUGFydHkgQmVzdCBBbmltYWwgLSBTYWxtb24iLCJNYW1tYWwgUGFydHkgWm9vIENvdW5jaWwgLSBCYWxsb3RzIENhc3QiLCJNYW1tYWwgUGFydHkgWm9vIENvdW5jaWwgLSBVbmRlcnZvdGVzIiwiTWFtbWFsIFBhcnR5IFpvbyBDb3VuY2lsIC0gT3ZlcnZvdGVzIiwiTWFtbWFsIFBhcnR5IFpvbyBDb3VuY2lsIC0gWmVicmEiLCJNYW1tYWwgUGFydHkgWm9vIENvdW5jaWwgLSBMaW9uIiwiTWFtbWFsIFBhcnR5IFpvbyBDb3VuY2lsIC0gS2FuZ2Fyb28iLCJNYW1tYWwgUGFydHkgWm9vIENvdW5jaWwgLSBFbGVwaGFudCIsIk1hbW1hbCBQYXJ0eSBab28gQ291bmNpbCAtIFdyaXRlIEluIiwiRmlzaCBQYXJ0eSBab28gQ291bmNpbCAtIEJhbGxvdHMgQ2FzdCIsIkZpc2ggUGFydHkgWm9vIENvdW5jaWwgLSBVbmRlcnZvdGVzIiwiRmlzaCBQYXJ0eSBab28gQ291bmNpbCAtIE92ZXJ2b3RlcyIsIkZpc2ggUGFydHkgWm9vIENvdW5jaWwgLSBNYW50YSBSYXkiLCJGaXNoIFBhcnR5IFpvbyBDb3VuY2lsIC0gUHVmZmVyZmlzaCIsIkZpc2ggUGFydHkgWm9vIENvdW5jaWwgLSBSb2NrZmlzaCIsIkZpc2ggUGFydHkgWm9vIENvdW5jaWwgLSBUcmlnZ2VyZmlzaCIsIkZpc2ggUGFydHkgWm9vIENvdW5jaWwgLSBXcml0ZSBJbiIsIkJhbGxvdCBNZWFzdXJlIDEgLSBCYWxsb3RzIENhc3QiLCJCYWxsb3QgTWVhc3VyZSAxIC0gVW5kZXJ2b3RlcyIsIkJhbGxvdCBNZWFzdXJlIDEgLSBPdmVydm90ZXMiLCJCYWxsb3QgTWVhc3VyZSAxIC0gWWVzIiwiQmFsbG90IE1lYXN1cmUgMSAtIE5vIiwiQmFsbG90IE1lYXN1cmUgMSAtIEJhbGxvdHMgQ2FzdCIsIkJhbGxvdCBNZWFzdXJlIDEgLSBVbmRlcnZvdGVzIiwiQmFsbG90IE1lYXN1cmUgMSAtIE92ZXJ2b3RlcyIsIkJhbGxvdCBNZWFzdXJlIDEgLSBZZXMiLCJCYWxsb3QgTWVhc3VyZSAxIC0gTm8iLCJCYWxsb3QgTWVhc3VyZSAzIC0gQmFsbG90cyBDYXN0IiwiQmFsbG90IE1lYXN1cmUgMyAtIFVuZGVydm90ZXMiLCJCYWxsb3QgTWVhc3VyZSAzIC0gT3ZlcnZvdGVzIiwiQmFsbG90IE1lYXN1cmUgMyAtIFllcyIsIkJhbGxvdCBNZWFzdXJlIDMgLSBObyIKbWlzc2luZy1iYXRjaC1pZCxNaXNzaW5nIEJhdGNoLHNjYW5uZXItMSwgc2Nhbm5lci0yLDMwMDAsMTQ5MCwxMjUsMTk0LDEyMyw5NSw5NTMsMTUxMCwxMjAsMTE5LDczLDExOTgsMTQ5MCw2NDYsMzY5LDc4MCw3NjksNjgwLDU3Nyw2NDksMTUxMCwzNTksMzA2LDU4Niw0NTQsMzY5LDQwOCw1MzgsMTQ5MCwxMTcxLDExNywxMjUsNzcsMTQ5MCwxMTcxLDExNywxMjUsNzcsMTUxMCwxMTk4LDczLDEyMCwxMTk=';

/**
 * MIME type of data/electionTwoPartyPrimary/csvFiles/batchResults.csv.
 */
export const mimeType = 'text/csv';

/**
 * Path to a file containing this file's contents.
 *
 * SHA-256 hash of file data: 02559dda9dca79d5eda2129b6ee8ee7fa92ab4b1e4331b73e82b2ea4052dd70c
 */
export function asFilePath(): string {
  const directoryPath = mkdtempSync(tmpdir() + sep);
  const filePath = join(directoryPath, 'batchResults.csv');
  writeFileSync(filePath, asBuffer());
  return filePath;
}

/**
 * Convert to a `data:` URL of data/electionTwoPartyPrimary/csvFiles/batchResults.csv, suitable for embedding in HTML.
 *
 * SHA-256 hash of file data: 02559dda9dca79d5eda2129b6ee8ee7fa92ab4b1e4331b73e82b2ea4052dd70c
 */
export function asDataUrl(): string {
  return `data:${mimeType};base64,${resourceDataBase64}`;
}

/**
 * Raw data of data/electionTwoPartyPrimary/csvFiles/batchResults.csv.
 *
 * SHA-256 hash of file data: 02559dda9dca79d5eda2129b6ee8ee7fa92ab4b1e4331b73e82b2ea4052dd70c
 */
export function asBuffer(): Buffer {
  return Buffer.from(resourceDataBase64, 'base64');
}

/**
 * Text content of data/electionTwoPartyPrimary/csvFiles/batchResults.csv.
 *
 * SHA-256 hash of file data: 02559dda9dca79d5eda2129b6ee8ee7fa92ab4b1e4331b73e82b2ea4052dd70c
 */
export function asText(): string {
  return asBuffer().toString('utf-8');
}
