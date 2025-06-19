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
   - Domains from [DuckDNS](https://www.duckdns.org/) or [Afraid.org](https://afraid.org/) are free and can be used for this 
- Moving your namservers to Cloudflare is preferred as it enables you to use Cloudflare DDNS, included in this template, to automatically create and maintain your DNS records (Note that this is not possible with DuckDNS or Afraid.org).

1. Ensure docker is installed per https://get.docker.com
2. Clone this repository and cd into it:
   ```
   cd /opt
   git clone https://github.com/Viren070/docker-compose-vps-template.git docker
   cd docker
   ```
3. Use a text editor to open the `.env` file in the `apps` folder. You can use `nano`, but I recommend using either **XPipe** or **VS Code (with the `Remote - SSH` extension)** to edit the files. 
   - If you are using nano, run this command:
     ```
     nano .env
     ```
4. After you fill in the initial values in the root .env, I'd recommend using the `required` profile only and running the following command to start Authelia and Traefik:
   ```
   docker compose --profile required up -d
   ```
5. Now, you can either start adding other `profiles` to the `COMPOSE_PROFILES` environment variable or use the `all` profile and fill in any other `.env` files if they exist for the services you want to use.
6. Finally, ensure you are in the root directory of the apps folder and not inside an app-specific folder (You can check this by running `pwd` and ensuring it returns `/opt/docker/apps`) and run this command to start all the services (according to your profiles in the `.env`)
   ```
   docker compose up -d
   ```
   - Ensure you defined the `COMPOSE_PROFILES` environment variable in the .env file, otherwise none of the services will start
      - You can also use the --profile flag e.g. docker compose --profile stremio --profile seanime up -d
      - This can be useful for other commands like `docker compose --profile seanime restart` or `docker compose --profile seanime logs` 
   - Ensure port 443 and port 80 are open.
   - If you have not setup Cloudflare DDNS in the .env by providing your token and using the `cloudflare-ddns` profile, you will need to manually create A records for each service you want to use using the subdomain in the .env file. 
   - Ensure you follow the instructions in the .env for any additional instructions that need to be carried out for some services (e.g. adding the prowlarr/jackett api keys or editing Seanime's config.toml)
  
