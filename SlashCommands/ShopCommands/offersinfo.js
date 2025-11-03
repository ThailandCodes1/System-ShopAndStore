const { Database, YAMLDriver } = require('st.db');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const db = new Database({
    driver: new YAMLDriver('./Database/Database.yaml')
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('offersinfo')
        .setDescription("عرض معلومات العروض")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option
                .setName('id')
                .setDescription('حدد ايدي العرض')
                .setRequired(true)
        ),
    async execute(interaction) {
        const offerId = interaction.options.getString('id');
        const offerData = await db.get(`offer_${offerId}`);

        if (!offerData) {
            return interaction.reply({
                content: `❌ مفيش عرض بالايدي ده: \`${offerId}\``,
                ephemeral: true
            });
        }

        const link = `https://discord.com/channels/${offerData.guildId}/${offerData.channelId}/${offerData.msgId}`;
        const guild = interaction.client.guilds.cache.get(offerData.guildId);
        const channel = guild?.channels.cache.get(offerData.channelId);

        const embed = new EmbedBuilder()
            .setTitle(`📦 معلومات العرض: ${offerId}`)
            .addFields(
                { name: '🧾 معرف الرسالة', value: offerData.msgId || 'غير متوفر', inline: true },
                { name: '💬 القناة', value: channel ? `<#${channel.id}>` : offerData.channelId || 'غير متوفر', inline: true },
                { name: '👤 البائع', value: `<@${offerData.sellerId}>`, inline: true },
                { name: '🏠 السيرفر', value: guild ? guild.name : offerData.guildId || 'غير متوفر', inline: true },
                { name: '🔗 رابط الرسالة', value: `[اضغط هنا للانتقال](${link})`, inline: false }
            )
            .setColor('Blue')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
