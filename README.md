# Public UI

Public UI is an Express and Electron application for interacting with a Standard Computers system through a local websocket connection or a hosted relay deployment.

## What It Includes

- Web runtime served by `node index.js`
- Electron desktop runtime via `electron-main.js`
- Handlebars-rendered UI with static assets under `public/`
- Optional weather and map integrations
- Built-in setup flow for desktop deployments

## Requirements

- Node.js 20+ recommended
- npm

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the example:

```bash
copy .env.example .env
```

3. Fill in the values you need for your environment.

4. Start the web app:

```bash
npm start
```

5. Or start the Electron app:

```bash
npm run start:desktop
```

## Important Environment Variables

- `APP_RUNTIME`: `server` or `electron`
- `MODE`: set to `relay` for hosted relay mode
- `CPP_WS_URL`: websocket endpoint for the backend system
- `STANDARD_CHIT`: optional default device token
- `RELAY_COOKIE_SECRET`: required in relay mode
- `OPENWEATHER_API_KEY`: optional server-side weather integration
- `MAPBOX_ACCESS_TOKEN`: optional token used by the browser UI for maps

## Security Notes

- `RELAY_COOKIE_SECRET` is required when `MODE=relay`. The app will now fail fast if relay mode is enabled without a secret.
- `MAPBOX_ACCESS_TOKEN` is exposed to the browser by design, so only use a public Mapbox token with appropriate restrictions.
- Do not commit `.env`, `user_data/`, `private/`, build output, or IDE metadata.

## Desktop Notes

The Electron setup flow can save endpoint and token configuration into `user_data/desktop-setup.json` at runtime. That file is local machine state and should stay out of version control.

## Scripts

- `npm start`: start the web runtime
- `npm run start:web`: alias for the web runtime
- `npm run start:desktop`: launch the Electron runtime
- `npm run build:desktop`: build unpacked Electron output
- `npm run dist:desktop`: create packaged Electron distributables

## Project Structure

- `index.js`: main Express server and websocket integration
- `electron-main.js`: Electron bootstrap
- `preload.js`: Electron preload bridge
- `views/`: Handlebars templates
- `public/`: static assets and documentation

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
