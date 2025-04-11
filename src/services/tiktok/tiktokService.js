const { WebcastPushConnection } = require('tiktok-live-connector');
const { TIKTOK_USERNAME, MAX_TENTATIVAS, INTERVALO_RECONEXAO, GIFT_ACTIONS } = require('../../config/constants');
const cookieService = require('../cookie/cookieService');

let tiktokLiveConnection = null;
let tentativasReconexao = 0;

// Função para processar gifts
async function processarGift(data) {
    try {
        const action = GIFT_ACTIONS[data.giftId];
        const repeatCount = data.repeatCount || 1;
        
        if (action) {
            // Se for um streak em andamento, não processa ainda
            if (data.giftType === 1 && !data.repeatEnd) {
                console.log(`${data.uniqueId} está enviando ${data.giftName} x${repeatCount} (streak em andamento)`);
                return;
            }

            // Processa o presente com o número final de repetições
            const totalClicks = action.clicks * repeatCount;
            
            if (action.clicks) {
                await cookieService.clicarCookie(totalClicks);
            }
            
            if (action.upgrade) {
                await cookieService.comprarUpgrade(action.upgrade);
            }
            
            if (action.product) {
                await cookieService.comprarUpgrade(action.product);
            }
            
            console.log(`${action.message} (${repeatCount}x)`);
        } else {
            // Presente não reconhecido - clica 50 vezes por padrão
            const totalClicks = 50 * repeatCount;
            await cookieService.clicarCookie(totalClicks);
            console.log(`Presente não reconhecido recebido: ${data.giftName} (ID: ${data.giftId}) x${repeatCount}. ${totalClicks} cliques no cookie!`);
        }
    } catch (err) {
        console.error('Erro ao processar gift:', err);
    }
}

// Função para configurar os eventos da live
function configurarEventos() {
    tiktokLiveConnection.on('like', data => {
        console.log(`${data.uniqueId} deixou ${data.likeCount} likes`);
        cookieService.clicarCookie(data.likeCount);
    });

    tiktokLiveConnection.on('chat', data => {
        console.log(`${data.uniqueId}: ${data.comment}`);
        cookieService.comprarUpgrade(data.comment);
    });

    tiktokLiveConnection.on('gift', data => {
        processarGift(data);
    });

    tiktokLiveConnection.on('disconnected', async () => {
        console.log('Desconectado da live. Fazendo backup e tentando reconectar...');
        await cookieService.fazerBackup();
        conectarLive();
    });
}

// Função para conectar à live
async function conectarLive() {
    try {
        console.log(`Tentando conectar à live do usuário: ${TIKTOK_USERNAME}`);
        tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME);
        
        const state = await tiktokLiveConnection.connect();
        
        if (!state || !state.roomId) {
            throw new Error('Conexão estabelecida, mas não foi possível obter o ID da sala');
        }
        
        console.log(`Conectado à sala com ID ${state.roomId}`);
        tentativasReconexao = 0;
        
        configurarEventos();
        
    } catch (err) {
        console.error('Falha ao conectar:', err.message);
        console.error('Detalhes do erro:', err);
        
        if (tentativasReconexao < MAX_TENTATIVAS) {
            tentativasReconexao++;
            console.log(`Tentando reconectar em ${INTERVALO_RECONEXAO/1000} segundos... (Tentativa ${tentativasReconexao}/${MAX_TENTATIVAS})`);
            setTimeout(conectarLive, INTERVALO_RECONEXAO);
        } else {
            console.log('Número máximo de tentativas atingido. Verifique se a live está online.');
        }
    }
}

// Função para desconectar da live
function desconectarLive() {
    if (tiktokLiveConnection) {
        tiktokLiveConnection.disconnect();
        tiktokLiveConnection = null;
    }
}

module.exports = {
    conectarLive,
    desconectarLive
}; 