import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testEmail() {
    const rcp = "clungz@gmail.com";
    console.log(`Sending test email to ${rcp}...`);
    console.log(`Using User: ${process.env.SMTP_USER}`);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false, // upgrade later with STARTTLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: '"Xiri Recruit" <ic-recruiter@xiri.ai>',
            to: rcp,
            subject: "Test Email from Xiri Agent",
            text: "This is a test email from your local Xiri development environment.",
            html: "<b>This is a test email</b> from your local Xiri development environment.",
        });

        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

testEmail();
