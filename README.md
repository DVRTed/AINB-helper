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

## Screenshots

- The main app (`main.vue`)

  <img alt="main app" width="70%" src="https://github.com/user-attachments/assets/275ef99c-1e6d-4936-b625-6245b9d2fcac" />
  <img alt="main app 2" width="70%" src="https://github.com/user-attachments/assets/b649b08c-19b1-404d-a985-49e601e68f51" />
- The LLM tag/prod app (`llm-tag-prod.vue`)

  <img alt="llm-tag-prod" width="70%" src="https://github.com/user-attachments/assets/40e0fb24-cfa7-43ec-9030-07e08a0bc75d" />
  <img alt="llm-tag-prod_2" width="70%" src="https://github.com/user-attachments/assets/78ecf21c-f63c-4594-88c6-38bd8b8f1cba" />
- The edit table app (`edit-table.vue`)

  <img alt="edit-table" width="70%" src="https://github.com/user-attachments/assets/c1913640-0bd0-4a7d-bdc2-64d892eac783" />
  <img alt="edit-table_2" width="70%" src="https://github.com/user-attachments/assets/485f99bf-841c-4614-8dea-6e25e5932ec3" />
- Progress bars (`page-features.js` and `category-stats.vue`)

  <img alt="progress_2" width="70%" src="https://github.com/user-attachments/assets/872a6fa8-c566-4360-b133-364458201a13" />
  <img alt="progress" width="70%" src="https://github.com/user-attachments/assets/ba60e6a3-a98b-4227-8dc4-d9b2c999d8c7" />
