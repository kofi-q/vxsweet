/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import { Buffer } from 'node:buffer';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

/**
 * Data of data/electionMultiPartyPrimary/csvFiles/batchResults.csv encoded as base64.
 *
 * SHA-256 hash of file data: e7586dee6a88b4f4eefc9d3715177150268fe77992a4298e1835934bc5ea63ef
 */
const resourceDataBase64 = 'QmF0Y2ggSUQsQmF0Y2ggTmFtZSxUYWJ1bGF0b3IsTnVtYmVyIG9mIEJhbGxvdHMsIkxpYmVydHkgUGFydHkgR292ZXJub3IgLSBCYWxsb3RzIENhc3QiLCJMaWJlcnR5IFBhcnR5IEdvdmVybm9yIC0gVW5kZXJ2b3RlcyIsIkxpYmVydHkgUGFydHkgR292ZXJub3IgLSBPdmVydm90ZXMiLCJMaWJlcnR5IFBhcnR5IEdvdmVybm9yIC0gQWFyb24gQWxsaWdhdG9yIiwiTGliZXJ0eSBQYXJ0eSBHb3Zlcm5vciAtIFBldGVyIFBpZ2VvbiIsIkxpYmVydHkgUGFydHkgR292ZXJub3IgLSBXcml0ZSBJbiIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBHb3Zlcm5vciAtIEJhbGxvdHMgQ2FzdCIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBHb3Zlcm5vciAtIFVuZGVydm90ZXMiLCJDb25zdGl0dXRpb24gUGFydHkgR292ZXJub3IgLSBPdmVydm90ZXMiLCJDb25zdGl0dXRpb24gUGFydHkgR292ZXJub3IgLSBLcmlzdGVuIEJlbGwiLCJDb25zdGl0dXRpb24gUGFydHkgR292ZXJub3IgLSBEYXggU2hlcGhlcmQiLCJDb25zdGl0dXRpb24gUGFydHkgR292ZXJub3IgLSBXcml0ZSBJbiIsIkZlZGVyYWxpc3QgUGFydHkgR292ZXJub3IgLSBCYWxsb3RzIENhc3QiLCJGZWRlcmFsaXN0IFBhcnR5IEdvdmVybm9yIC0gVW5kZXJ2b3RlcyIsIkZlZGVyYWxpc3QgUGFydHkgR292ZXJub3IgLSBPdmVydm90ZXMiLCJGZWRlcmFsaXN0IFBhcnR5IEdvdmVybm9yIC0gRWxlYW5vciBTaGVsbHN0cm9wIiwiRmVkZXJhbGlzdCBQYXJ0eSBHb3Zlcm5vciAtIENoaWRpIEFuYWdvbnllIiwiRmVkZXJhbGlzdCBQYXJ0eSBHb3Zlcm5vciAtIFdyaXRlIEluIiwiTGliZXJ0eSBQYXJ0eSBNYXlvciAtIEJhbGxvdHMgQ2FzdCIsIkxpYmVydHkgUGFydHkgTWF5b3IgLSBVbmRlcnZvdGVzIiwiTGliZXJ0eSBQYXJ0eSBNYXlvciAtIE92ZXJ2b3RlcyIsIkxpYmVydHkgUGFydHkgTWF5b3IgLSBUYWhhbmkgQWwtSmFtaWwiLCJMaWJlcnR5IFBhcnR5IE1heW9yIC0gSmFzb24gTWVuZG96YSIsIkxpYmVydHkgUGFydHkgTWF5b3IgLSBXcml0ZSBJbiIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBNYXlvciAtIEJhbGxvdHMgQ2FzdCIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBNYXlvciAtIFVuZGVydm90ZXMiLCJDb25zdGl0dXRpb24gUGFydHkgTWF5b3IgLSBPdmVydm90ZXMiLCJDb25zdGl0dXRpb24gUGFydHkgTWF5b3IgLSBUaW5hIFdlc3NvbiIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBNYXlvciAtIEV0aGFuIFpvaG4iLCJDb25zdGl0dXRpb24gUGFydHkgTWF5b3IgLSBXcml0ZSBJbiIsIkZlZGVyYWxpc3QgUGFydHkgTWF5b3IgLSBCYWxsb3RzIENhc3QiLCJGZWRlcmFsaXN0IFBhcnR5IE1heW9yIC0gVW5kZXJ2b3RlcyIsIkZlZGVyYWxpc3QgUGFydHkgTWF5b3IgLSBPdmVydm90ZXMiLCJGZWRlcmFsaXN0IFBhcnR5IE1heW9yIC0gVmVjZXBpYSBUb3dlcnkiLCJGZWRlcmFsaXN0IFBhcnR5IE1heW9yIC0gQnJhaW4gSGVpZGlrIiwiRmVkZXJhbGlzdCBQYXJ0eSBNYXlvciAtIFdyaXRlIEluIiwiTGliZXJ0eSBQYXJ0eSBBc3Npc3RhbnQgTWF5b3IgLSBCYWxsb3RzIENhc3QiLCJMaWJlcnR5IFBhcnR5IEFzc2lzdGFudCBNYXlvciAtIFVuZGVydm90ZXMiLCJMaWJlcnR5IFBhcnR5IEFzc2lzdGFudCBNYXlvciAtIE92ZXJ2b3RlcyIsIkxpYmVydHkgUGFydHkgQXNzaXN0YW50IE1heW9yIC0gSmVubmEgTW9yYXNjYSIsIkxpYmVydHkgUGFydHkgQXNzaXN0YW50IE1heW9yIC0gU2FuZHJhIERpYXotVHdpbmUiLCJMaWJlcnR5IFBhcnR5IEFzc2lzdGFudCBNYXlvciAtIFdyaXRlIEluIiwiTGliZXJ0eSBQYXJ0eSBDaGllZiBQb2tlbW9uIC0gQmFsbG90cyBDYXN0IiwiTGliZXJ0eSBQYXJ0eSBDaGllZiBQb2tlbW9uIC0gVW5kZXJ2b3RlcyIsIkxpYmVydHkgUGFydHkgQ2hpZWYgUG9rZW1vbiAtIE92ZXJ2b3RlcyIsIkxpYmVydHkgUGFydHkgQ2hpZWYgUG9rZW1vbiAtIEJ1bGJhc2F1ciIsIkxpYmVydHkgUGFydHkgQ2hpZWYgUG9rZW1vbiAtIENoYXJtYW5kZXIiLCJMaWJlcnR5IFBhcnR5IENoaWVmIFBva2Vtb24gLSBTcXVpcnRsZSIsIkxpYmVydHkgUGFydHkgQ2hpZWYgUG9rZW1vbiAtIFdyaXRlIEluIiwiQ29uc3RpdHV0aW9uIFBhcnR5IENoaWVmIFBva2Vtb24gLSBCYWxsb3RzIENhc3QiLCJDb25zdGl0dXRpb24gUGFydHkgQ2hpZWYgUG9rZW1vbiAtIFVuZGVydm90ZXMiLCJDb25zdGl0dXRpb24gUGFydHkgQ2hpZWYgUG9rZW1vbiAtIE92ZXJ2b3RlcyIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBDaGllZiBQb2tlbW9uIC0gRmxhcmVvbiIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBDaGllZiBQb2tlbW9uIC0gVW1icmVvbiIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBDaGllZiBQb2tlbW9uIC0gVmFwb3Jlb24iLCJDb25zdGl0dXRpb24gUGFydHkgQ2hpZWYgUG9rZW1vbiAtIFdyaXRlIEluIiwiRmVkZXJhbGlzdCBQYXJ0eSBDaGllZiBQb2tlbW9uIC0gQmFsbG90cyBDYXN0IiwiRmVkZXJhbGlzdCBQYXJ0eSBDaGllZiBQb2tlbW9uIC0gVW5kZXJ2b3RlcyIsIkZlZGVyYWxpc3QgUGFydHkgQ2hpZWYgUG9rZW1vbiAtIE92ZXJ2b3RlcyIsIkZlZGVyYWxpc3QgUGFydHkgQ2hpZWYgUG9rZW1vbiAtIFBpa2FjaHUiLCJGZWRlcmFsaXN0IFBhcnR5IENoaWVmIFBva2Vtb24gLSBFZXZlZSIsIkZlZGVyYWxpc3QgUGFydHkgQ2hpZWYgUG9rZW1vbiAtIFdyaXRlIEluIiwiTGliZXJ0eSBQYXJ0eSBTY2hvb2xib2FyZCAtIEJhbGxvdHMgQ2FzdCIsIkxpYmVydHkgUGFydHkgU2Nob29sYm9hcmQgLSBVbmRlcnZvdGVzIiwiTGliZXJ0eSBQYXJ0eSBTY2hvb2xib2FyZCAtIE92ZXJ2b3RlcyIsIkxpYmVydHkgUGFydHkgU2Nob29sYm9hcmQgLSBBbWJlciBCcmtpY2giLCJMaWJlcnR5IFBhcnR5IFNjaG9vbGJvYXJkIC0gQ2hyaXMgRGF1Z2hlcnR5IiwiTGliZXJ0eSBQYXJ0eSBTY2hvb2xib2FyZCAtIFRvbSBXZXN0bWFuIiwiTGliZXJ0eSBQYXJ0eSBTY2hvb2xib2FyZCAtIERhbm4gQm9hdHdyaWdodCIsIkxpYmVydHkgUGFydHkgU2Nob29sYm9hcmQgLSBXcml0ZSBJbiIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBTY2hvb2xib2FyZCAtIEJhbGxvdHMgQ2FzdCIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBTY2hvb2xib2FyZCAtIFVuZGVydm90ZXMiLCJDb25zdGl0dXRpb24gUGFydHkgU2Nob29sYm9hcmQgLSBPdmVydm90ZXMiLCJDb25zdGl0dXRpb24gUGFydHkgU2Nob29sYm9hcmQgLSBBcmFzIEJhc2thdXNrYXMiLCJDb25zdGl0dXRpb24gUGFydHkgU2Nob29sYm9hcmQgLSBZdWwgS3dvbiIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBTY2hvb2xib2FyZCAtIEVhcmwgQ29sZSIsIkNvbnN0aXR1dGlvbiBQYXJ0eSBTY2hvb2xib2FyZCAtIFRvZGQgSGVyem9nIiwiQ29uc3RpdHV0aW9uIFBhcnR5IFNjaG9vbGJvYXJkIC0gV3JpdGUgSW4iLCJGZWRlcmFsaXN0IFBhcnR5IFNjaG9vbGJvYXJkIC0gQmFsbG90cyBDYXN0IiwiRmVkZXJhbGlzdCBQYXJ0eSBTY2hvb2xib2FyZCAtIFVuZGVydm90ZXMiLCJGZWRlcmFsaXN0IFBhcnR5IFNjaG9vbGJvYXJkIC0gT3ZlcnZvdGVzIiwiRmVkZXJhbGlzdCBQYXJ0eSBTY2hvb2xib2FyZCAtIFBhcnZhdGkgU2hhbGxvdyIsIkZlZGVyYWxpc3QgUGFydHkgU2Nob29sYm9hcmQgLSBCb2IgQ3Jvd2xleSIsIkZlZGVyYWxpc3QgUGFydHkgU2Nob29sYm9hcmQgLSBKVCBUaG9tYXMiLCJGZWRlcmFsaXN0IFBhcnR5IFNjaG9vbGJvYXJkIC0gTmF0YWxpZSBXaGl0ZSIsIkZlZGVyYWxpc3QgUGFydHkgU2Nob29sYm9hcmQgLSBXcml0ZSBJbiIKMTIzNC0xLEJhdGNoIDEsc2Nhbm5lci0xLDc1MiwyNDYsMjUsMjUsMjUsMTQ2LDI1LDM5MCwyOSwyOCwyOCwyNzcsMjgsMTE2LDE1LDE1LDE1LDU2LDE1LDYyLDEzLDEzLDEyLDEyLDEyLDM5MCwyOSwyOCwyOCwyNzcsMjgsOTEsMTAsMTAsMTAsNTEsMTAsNjIsMTMsMTMsMTIsMTIsMTIsMTg0LDEyLDI1LDEzLDEzLDEwOCwxMywzOTAsMjksNTYsMjgsMjgsMjIxLDI4LDY2LDUsNSw1LDQ2LDUsMTg0LDM2LDUyLDY1LDU0LDU0LDU1LDUyLDM5MCw4NiwxMTIsMTM5LDExMCwxMTEsMTEwLDExMiw2NiwxNSwyMCwyNCwxOCwxOCwxNywyMAoxMjM0LTMsQmF0Y2ggMSxzY2FubmVyLTIsMTUxMCw1NzAsNjAsNjAsNjAsMzMwLDYwLDcwMCw1MCw1MCw1MCw1MDAsNTAsMjQwLDMwLDMwLDMwLDEyMCwzMCwxNTAsMzAsMzAsMzAsMzAsMzAsNzAwLDUwLDUwLDUwLDUwMCw1MCwxOTAsMjAsMjAsMjAsMTEwLDIwLDE1MCwzMCwzMCwzMCwzMCwzMCw0MjAsMzAsNjAsMzAsMzAsMjQwLDMwLDcwMCw1MCwxMDAsNTAsNTAsNDAwLDUwLDE0MCwxMCwxMCwxMCwxMDAsMTAsNDIwLDkwLDEyMCwxNTAsMTIwLDEyMCwxMjAsMTIwLDcwMCwxNTAsMjAwLDI1MCwyMDAsMjAwLDIwMCwyMDAsMTQwLDMwLDQwLDUwLDQwLDQwLDQwLDQwCjEyMzQtNCxCYXRjaCAxLHNjYW5uZXItMywxNTEwLDU3MCw2MCw2MCw2MCwzMzAsNjAsNzAwLDUwLDUwLDUwLDUwMCw1MCwyNDAsMzAsMzAsMzAsMTIwLDMwLDE1MCwzMCwzMCwzMCwzMCwzMCw3MDAsNTAsNTAsNTAsNTAwLDUwLDE5MCwyMCwyMCwyMCwxMTAsMjAsMTUwLDMwLDMwLDMwLDMwLDMwLDQyMCwzMCw2MCwzMCwzMCwyNDAsMzAsNzAwLDUwLDEwMCw1MCw1MCw0MDAsNTAsMTQwLDEwLDEwLDEwLDEwMCwxMCw0MjAsOTAsMTIwLDE1MCwxMjAsMTIwLDEyMCwxMjAsNzAwLDE1MCwyMDAsMjUwLDIwMCwyMDAsMjAwLDIwMCwxNDAsMzAsNDAsNTAsNDAsNDAsNDAsNDAKMTIzNC0yLEJhdGNoIDIsc2Nhbm5lci0xLDc1OCwzMjQsMzUsMzUsMzUsMTg0LDM1LDMxMCwyMSwyMiwyMiwyMjMsMjIsMTI0LDE1LDE1LDE1LDY0LDE1LDg4LDE3LDE3LDE4LDE4LDE4LDMxMCwyMSwyMiwyMiwyMjMsMjIsOTksMTAsMTAsMTAsNTksMTAsODgsMTcsMTcsMTgsMTgsMTgsMjM2LDE4LDM1LDE3LDE3LDEzMiwxNywzMTAsMjEsNDQsMjIsMjIsMTc5LDIyLDc0LDUsNSw1LDU0LDUsMjM2LDU0LDY4LDg1LDY2LDY2LDY1LDY4LDMxMCw2NCw4OCwxMTEsOTAsODksOTAsODgsNzQsMTUsMjAsMjYsMjIsMjIsMjMsMjA=';

/**
 * MIME type of data/electionMultiPartyPrimary/csvFiles/batchResults.csv.
 */
export const mimeType = 'text/csv';

/**
 * Path to a file containing this file's contents.
 *
 * SHA-256 hash of file data: e7586dee6a88b4f4eefc9d3715177150268fe77992a4298e1835934bc5ea63ef
 */
export function asFilePath(): string {
  const directoryPath = mkdtempSync(tmpdir() + sep);
  const filePath = join(directoryPath, 'batchResults.csv');
  writeFileSync(filePath, asBuffer());
  return filePath;
}

/**
 * Convert to a `data:` URL of data/electionMultiPartyPrimary/csvFiles/batchResults.csv, suitable for embedding in HTML.
 *
 * SHA-256 hash of file data: e7586dee6a88b4f4eefc9d3715177150268fe77992a4298e1835934bc5ea63ef
 */
export function asDataUrl(): string {
  return `data:${mimeType};base64,${resourceDataBase64}`;
}

/**
 * Raw data of data/electionMultiPartyPrimary/csvFiles/batchResults.csv.
 *
 * SHA-256 hash of file data: e7586dee6a88b4f4eefc9d3715177150268fe77992a4298e1835934bc5ea63ef
 */
export function asBuffer(): Buffer {
  return Buffer.from(resourceDataBase64, 'base64');
}

/**
 * Text content of data/electionMultiPartyPrimary/csvFiles/batchResults.csv.
 *
 * SHA-256 hash of file data: e7586dee6a88b4f4eefc9d3715177150268fe77992a4298e1835934bc5ea63ef
 */
export function asText(): string {
  return asBuffer().toString('utf-8');
}
