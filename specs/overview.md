---
type: Specification
title: Overview
description: What KS Utility is for, who uses it and how it is laid out.
tags: [overview, utilities, layout]
status: draft
---

# Overview

Common utility functions shared across the KS-Suite apps. Everything here is generic: a utility can be dragged and dropped into any suite app, today's or a later one, and used as it is. Application-specific logic does not belong in this repository.

| | |
|---|---|
| **Used by** | Any KS-Suite app |
| **Language** | Kotlin; another language gets its own top-level folder when an app first needs it |

## Layout

- `kotlin/`: Kotlin utilities, package `com.ks.utility`. One utility per file or per folder.

## How apps use it

An app copies the utility's file or folder into its own source tree. No app depends on this repository at build time or at run time, so each app still builds, ships and works alone ([Rules](rules.md)).

The repository is planned: it holds the structure and its rules, with utilities still to come.
