# AINB-helper

For further information, see the **[AINB-helper script page](https://en.wikipedia.org/wiki/User:DVRTed/AINB-helper)** on the English Wikipedia. Feel free to post bug reports, feature requests, or suggestions on [the script's talk page](https://en.wikipedia.org/wiki/User_talk:DVRTed/AINB-helper) or in this repository.

## Quick overview

This project uses Vite to build Codex-based Vue components (referred to as "apps" throughout the codebase) into a single file. The style file, along with all the `.vue` files inside the `/src/` directory, gets built into the **`dist/AINB-helper.js`** file.

## Building

Install the build dependencies:

```sh
npm install
```

Build for production:

```sh
npm run build
```

## Contributing

1. Fork (and clone) the repo.
2. Make your changes.
3. Test your changes:
   - Build the script (`npm run build`).
   - Import the built `dist/AINB-helper.js` file on Wikipedia (e.g., copy the contents to `User:Username/sandbox/temp.js` and import it through your `common.js`).
   - **Note:** You can continuously build the project in development mode with `npm run dev`. While running, it rebuilds `dist/AINB-helper.js` on every change without minifying it. This works best if you set up a `localhost` import in your `common.js`—see [Wikipedia:User scripts/Guide](https://en.wikipedia.org/wiki/Wikipedia:User_scripts/Guide#Loading_it_from_a_localhost_web_server).
4. Commit, push, and open a pull request.

## Advanced overview

There's a `build:usync` script that sets the `USYNC=1` environment variable before triggering a Vite build in production mode. The `USYNC` flag adds the USync banner at the top of the built script. The GitHub Actions workflow (`.github/workflows/public-prod.yml`) uses this script to build the file and commit it to the `prod` branch. That branch is specified in the USync template in the script's source code on Wikipedia, so the final output is automatically synced there. See [Wikipedia:USync](https://en.wikipedia.org/wiki/Wikipedia:USync) for details on how it works.
