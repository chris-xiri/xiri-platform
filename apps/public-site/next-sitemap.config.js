/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: process.env.SITE_URL || 'https://www.xiri.com',
    generateRobotsTxt: true, // (optional)
    // ...other options
    exclude: ['/admin/*'],
    robotsTxtOptions: {
        policies: [
            {
                userAgent: '*',
                allow: '/',
            },
            {
                userAgent: '*',
                disallow: ['/admin'],
            },
        ],
    },
}
