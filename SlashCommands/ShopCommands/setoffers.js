const { Database , YAMLDriver} = require('st.db');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = new Database({
    driver: new YAMLDriver('./Database/Database.yaml')
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setoffers')
        .setDescription('تحديد روم العروض')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
       .addChannelOption(option =>
                option
                        .setName('channel')
                        .setDescription('تحديد روم العروض')
                        .addChannelTypes(0)
                        .setRequired(true)
        ),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel')
        db.set(`offers_${interaction.guild.id}`, {
            channelID: channel.id
        });

        await interaction.reply({
            content: `✅ تم تحديد روم العروض بنجاح: ${channel}`,
            ephemeral: true
        });
    }
};
