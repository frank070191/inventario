# inventario

A modern Express.js application with Google Sheets integration, built with TypeScript/JavaScript and ready for deployment on Vercel and Render.

## Features

- 🚀 Express.js server with TypeScript/JavaScript
- 📊 Google Sheets integration with CRUD operations
- 🔒 Security middleware (Helmet, CORS, Rate limiting)
- 📝 API documentation with Swagger
- ✅ Request validation with Zod
- 🎨 Modern development setup
- ☁️ Vercel and Render deployment ready

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

3. Configure Google Sheets credentials in `.env`

4. Start development server:
   ```bash
   npm run dev
   ```

5. View API documentation at http://localhost:3000/api-docs

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `PORT`: Server port (default: 3000)
- `GOOGLE_SHEET_ID`: Your Google Spreadsheet ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google service account email
- `GOOGLE_PRIVATE_KEY`: Google service account private key (PEM format)
- `NODE_ENV`: Environment (development/production)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins (production)

## Available Scripts

- `npm run dev`: Start development server with hot reload
- `npm start`: Start production server
- `npm run build`: Build TypeScript to JavaScript
- `npm run lint`: Run ESLint
- `npm run lint:fix`: Fix ESLint issues

## Project Structure

```
├── config/          # Configuration files
├── docs/           # Swagger documentation
├── middlewares/    # Express middlewares
├── routes/         # API routes (auto-generated CRUD routes)
├── utils/          # Utility functions
├── dist/           # Compiled JavaScript (production)
├── vercel.json     # Vercel deployment config
├── render.yaml     # Render deployment config
└── index.ts        # Express app entry point
```

## Deployment

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project directory
3. Follow the prompts

### Render
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Render will automatically detect the configuration from `render.yaml`

## Google Sheets Setup

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create a Service Account
4. Download the JSON credentials
5. Add the credentials to your `.env` file
6. Share your Google Sheet with the service account email

## License

MIT
