/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Claude Credentials Path - Path to Claude credentials file */
  "credentialsPath": string,
  /** Codex Credentials Path - Path to Codex auth file */
  "codexCredentialsPath": string,
  /** Menu Bar Display - Show remaining capacity or current usage in the menu bar */
  "menuBarDisplay": "remaining" | "usage",
  /** Default Model - Default model for cost calculation */
  "defaultModel": "opus" | "sonnet"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `menu-bar` command */
  export type MenuBar = ExtensionPreferences & {}
  /** Preferences accessible in the `token-watcher` command */
  export type TokenWatcher = ExtensionPreferences & {}
  /** Preferences accessible in the `token-watcher-projects` command */
  export type TokenWatcherProjects = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `menu-bar` command */
  export type MenuBar = {}
  /** Arguments passed to the `token-watcher` command */
  export type TokenWatcher = {}
  /** Arguments passed to the `token-watcher-projects` command */
  export type TokenWatcherProjects = {}
}

