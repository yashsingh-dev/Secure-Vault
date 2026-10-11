FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Ensure non-root node user owns the working directory
RUN chown -R node:node /app
USER node

ARG ENVIRONMENT=production
ENV NODE_ENV=${ENVIRONMENT}
ENV PORT=3000

# Install production dependencies only using package-lock.json
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy server application source code
COPY --chown=node:node . ./

# Expose server port
EXPOSE 3000

ENTRYPOINT ["node"]
CMD ["server.js"]
