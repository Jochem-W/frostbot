import type { Component } from "./models/component.mjs"
import { ComponentType } from "discord.js"

export const Components = new Map<string, Component<ComponentType>>()
