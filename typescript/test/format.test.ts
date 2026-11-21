import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytes, formatSpeed, formatTimeLeft } from "../src/index.ts";

test("formatBytes", () => {
  assert.equal(formatBytes(null), "Unknown");
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1023), "1023 B");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(150 * 1024), "150 KB");
  assert.equal(formatBytes(1.2 * 1024 ** 3), "1.2 GB");
  assert.equal(formatBytes(2048 * 1024 ** 4), "2048 TB");
});

test("formatSpeed", () => {
  assert.equal(formatSpeed(0), "");
  assert.equal(formatSpeed(-5), "");
  assert.equal(formatSpeed(18.4 * 1024 ** 2), "18.4 MB/s");
});

test("formatTimeLeft", () => {
  assert.equal(formatTimeLeft(null), "");
  assert.equal(formatTimeLeft(Number.POSITIVE_INFINITY), "");
  assert.equal(formatTimeLeft(Number.NaN), "");
  assert.equal(formatTimeLeft(-3), "0:00");
  assert.equal(formatTimeLeft(42.4), "0:42");
  assert.equal(formatTimeLeft(65), "1:05");
  assert.equal(formatTimeLeft(3600 + 2 * 60 + 3), "1:02:03");
});
