# frostbot

Advanced moderation bot for a now defunct Discord server. Embeds layout and UX
are based off of [shackhorn](https://github.com/shackhorn)'s Goobism V3.

![menu.gif](assets/menu.gif)

![rank.png](assets/rank.png)

## Usage

To get started, set-up an S3-compatible storage bucket and a Postgres database, and push the Drizzle schema to the database using `drizzle-kit`. Next, fill in and rename the `example.config.json` and `example.env` files. Finally, compile the TypeScript code to JavaScript, and run `dist/index.mjs`.

## License

Code in this repository is licensed under the AGPL 3.0 license.
