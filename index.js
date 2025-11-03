const { Client, GatewayIntentBits, Partials, Events, Collection } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});
require('dotenv').config();

client.on(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

module.exports = client;

client.SlashCommands = new Collection();
client.Events = new Collection();
client.aliases = new Collection();

["SlashCommand", "Events"].forEach((handler) => {
  require(`./Handlers/${handler}`)(client);
});












client.login(process.env.token);