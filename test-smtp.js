const nodemailer = require('nodemailer');

async function testSMTP() {
    const transporter = nodemailer.createTransport({
        host: 'mail.cortdevs.com',
        port: 465,
        secure: true,
        auth: {
            user: 'projects@cortdevs.com',
            pass: '@project$@cortdev$@',
        },
    });

    console.log('Verifying SMTP connection...');

    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified successfully!');

        console.log('Sending test email...');
        const info = await transporter.sendMail({
            from: '"Test Connection" <projects@cortdevs.com>',
            to: 'projects@cortdevs.com',
            subject: 'SMTP Connection Test',
            text: 'If you see this, your SMTP configuration for CortDevs is working perfectly.',
            html: '<b>Success!</b> Your SMTP configuration for CortDevs is working perfectly.',
        });

        console.log('✅ Test email sent: %s', info.messageId);
    } catch (error) {
        console.error('❌ SMTP Error:', error);
    }
}

testSMTP();
