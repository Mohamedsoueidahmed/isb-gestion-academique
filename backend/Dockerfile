# --- Étape 1 : construction ---
# Image complète (avec les outils de compilation), jetée après le build —
# jamais présente dans l'image finale, qui reste légère.
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

# --- Étape 2 : production ---
# Repart d'une image neuve et minimale — seuls le résultat compilé (dist/)
# et les dépendances de PRODUCTION (--omit=dev) y entrent, jamais les
# sources TypeScript ni les outils de développement.
FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/assets ./dist/assets

# Applique les migrations en attente, puis démarre — à chaque démarrage du
# conteneur, jamais seulement à la construction de l'image (une image
# construite aujourd'hui doit pouvoir appliquer une migration ajoutée
# demain, sans être reconstruite).
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/serveur.js"]

EXPOSE 3000
