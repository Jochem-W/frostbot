/**
 * Licensed under AGPL 3.0 or newer. Copyright (C) 2024 Jochem W. <license (at) jochem (dot) cc>
 */
import type { Component } from "./models/component.mjs"
import { ComponentType } from "discord.js"

export const Components = new Map<string, Component<ComponentType>>()
