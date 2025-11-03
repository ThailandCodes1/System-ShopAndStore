const { Database , YAMLDriver} = require('st.db');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = new Database({
    driver: new YAMLDriver('./Database/Database.yaml')
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autotax')
        .setDescription('تحديد روم الضرائب التلقائية')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
       .addChannelOption(option =>
                option
                        .setName('channel')
                        .setDescription('حدد روم الضرائب التلقائية')
                        .addChannelTypes(0)
                        .setRequired(true)
        ),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel')
        db.set(`autotax_${interaction.guild.id}`, {
            channelID: channel.id
        });

        await interaction.reply({
            content: `✅ تم تحديد روم الضرائب التلقائية بنجاح: ${channel}`,
            ephemeral: true
        });
    }
};
