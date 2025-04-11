module.exports = {
    TIKTOK_USERNAME: 'maesttrya',
    MAX_TENTATIVAS: 5,
    INTERVALO_RECONEXAO: 30000, // 30 segundos
    CLICKS_PER_BATCH: 50,
    BATCH_DELAY: 100,
    MAX_RETRIES: 3,
    GIFT_ACTIONS: {
        // Presentes comuns
        '5655': { // Rose
            clicks: 100,
            message: 'Obrigado pelo Rose! 100 cliques no cookie!'
        },
        '5656': { // Lion
            clicks: 500,
            upgrade: 'up1',
            message: 'Obrigado pelo Lion! 500 cliques e um upgrade!'
        },
        '5657': { // Universe
            clicks: 1000,
            upgrade: 'up2',
            product: 'Cursor',
            message: 'Obrigado pelo Universe! 1000 cliques, upgrade e produto!'
        },
        // Adicione mais presentes conforme necessário
        // Exemplo:
        // '5658': {
        //     clicks: 200,
        //     message: 'Obrigado pelo presente! 200 cliques no cookie!'
        // }
    }
}; 