# Docker Compose VPS Template

A template compose.yaml to self host various applications on a server/VPS using Docker Compose with Traefik as a reverse proxy, using Authelia for authentication.

This is a template, so feel free to edit it by removing or adding services as you see fit.

You can use the Always Free resources of Oracle to set this up. Here is a [set up guide](https://guides.viren070.me/oracle) I made for that. 

A full start-to-finish guide, which assumes you start from scratch, can be found on my site [here](https://guides.viren070.me/selfhosting).
It will go through setting up an Oracle VPS for free, installing Docker, and then a guide on using this compose.yaml. 

This is the general guide:

Prerequisites:
- A VPS with Docker installed. 
- Port 80 and 443 open.
- A domain with DNS records pointing to the VPS IP for each domain/subdomain you want to use.
   - Domains from [DuckDNS](https://www.duckdns.org/) or [Afraid.org](https://afraid.org/) are free and can be used for this.


1. Ensure docker is installed per https://get.docker.com
2. Clone this repository and cd into it:
   ```
   cd /opt

   git clone https://github.com/Viren070/docker-compose-vps-template.git docker
   cd docker
   ```
3. Open the .env file using:
   ```
   cd apps
   nano .env
   ```
4. Fill in all the values, making sure to read all the comments, and filling in any other files that are mentioned. 
5. Fill in the .env files within the services you are using, e.g. `seanime/.env` or `stremio/.env`.
6. Ensure you are in the root directory of the apps folder and not inside an app-specific folder. 
   - You can check this by running `pwd` and ensuring it returns `/opt/docker/apps`.
7. Run this command:
   ```
   docker compose up -d
   ```
   - Ensure you defined the `COMPOSE_PROFILES` environment variable in the .env file, otherwise only the default services will be started.
      - You can also use the --profile flag e.g. docker compose --profile stremio --profile seanime up -d
   - You can check the compose.yaml or the full guide above to see what profiles are available.
   - Ensure port 443 and port 80 is open
   - Ensure you have DNS records that handle each hostname you are making use of which will point the hostname to the public IP of your server
   - Ensure you follow the instructions in the .env for any additional instructions that need to be carried out for some services (e.g. adding the prowlarr/jackett api keys or editing Seanime's config.toml)
  
