from node:20-alpine
workdir /app
copy package*.json ./
run npm install
copy . .
cmd ["npm","run","build","&&","npm","start"]