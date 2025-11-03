const { Database , YAMLDriver} = require('st.db');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = new Database({
    driver: new YAMLDriver('./Database/Database.yaml')
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setmode')
        .setDescription("تحديد نظام النشر")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('اختر نظام النشر')
                .setRequired(true)
                .addChoices(
                    { name: 'سيرفرات الشوب', value: 'shops' },
                    { name: 'سيرفرات الاستور', value: 'store' },
                )
),
    async execute(interaction) {
        const mode = interaction.options.getString('mode');
        if (mode === 'shops') {
            db.set(`server_mode_${interaction.guild.id}`, 'shops');
            await interaction.reply({
                content: '✅ تم تعيين نظام النشر إلى **سيرفرات الشوب** بنجاح!',
                ephemeral: true
            });
        } else if (mode === 'store') {
            db.set(`server_mode_${interaction.guild.id}`, 'store');
            await interaction.reply({
                content: '✅ تم تعيين نظام النشر إلى **سيرفرات الاستور** بنجاح!',
                ephemeral: true
            });
        }
    }
};
