# --- Étape 1 : construction ---
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Relative (/api) plutôt qu'une vraie adresse — le navigateur appelle
# toujours la MÊME origine qui sert la page elle-même, jamais le port
# du backend directement. C'est nginx.conf, juste en dessous, qui
# redirige ensuite /api en interne vers le bon conteneur.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Étape 2 : production ---
# Juste nginx et les fichiers déjà construits — plus jamais Node.js ni
# le code source une fois cette étape atteinte.
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
