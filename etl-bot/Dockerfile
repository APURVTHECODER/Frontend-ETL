# Stage 1: Build the React application
FROM node:18-alpine as build

WORKDIR /app

# --- Define ARGs to receive values from docker build command ---
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG APPID
ARG MEASUREMENTID
ARG MESSAGINGSENDERID
ARG PROJECTID
ARG STORAGEBUCKET
ARG VITE_API_BASE_URL

# --- End ARGs ---

# --- Set ENV vars FROM the ARGs ---
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_APPID=$APPID
ENV VITE_MEASUREMENTID=$MEASUREMENTID
ENV VITE_MESSAGINGSENDERID=$MESSAGINGSENDERID
ENV VITE_PROJECTID=$PROJECTID
ENV VITE_STORAGEBUCKET=$STORAGEBUCKET
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package files and install dependencies, including devDependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve static files using Node.js
FROM node:18-alpine as production

WORKDIR /app

# Install a simple static file server (http-server)
RUN npm install -g http-server

# Copy the built files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 3000 (or another port if necessary)
EXPOSE 80

# Start the static file server
# CMD ["http-server", "/usr/share/nginx/html", "-p", "3000"]
CMD ["http-server","/usr/share/nginx/html","-p","80","--fallback", "index.html"]