const { Database , YAMLDriver} = require('st.db');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = new Database({
    driver: new YAMLDriver('./Database/Database.yaml')
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setsuggestion')
        .setDescription('تحديد روم الاقتراحات')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
       .addChannelOption(option =>
                option
                        .setName('channel')
                        .setDescription('حدد روم الاقتراحات')
                        .addChannelTypes(0)
                        .setRequired(true)
        ),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel')
        db.set(`suggestion_${interaction.guild.id}`, {
            channelID: channel.id
        });

        await interaction.reply({
            content: `✅ تم تحديد روم الاقتراحات بنجاح: ${channel}`,
            ephemeral: true
        });
    }
};
