const { WebcastPushConnection } = require('tiktok-live-connector');
const { TIKTOK_USERNAME, MAX_TENTATIVAS, INTERVALO_RECONEXAO, GIFT_ACTIONS } = require('../../config/constants');
const cookieService = require('../cookie/cookieService');

let tiktokLiveConnection = null;
let tentativasReconexao = 0;
let ultimoTempoReconexao = 0;

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

// Função para controlar a loja
async function controlarLoja(acao) {
    try {
        const page = cookieService.getPage();
        if (!page) {
            console.error('Página não encontrada');
            return;
        }

        const PIXELS_POR_MOVIMENTO = 200; // Quantidade fixa de pixels para mover

        if (acao === 'baixo') {
            await page.evaluate((pixels) => {
                const sectionRight = document.getElementById('sectionRight');
                if (sectionRight) {
                    sectionRight.scrollTop += pixels;
                }
            }, PIXELS_POR_MOVIMENTO);
            console.log(`Loja movida ${PIXELS_POR_MOVIMENTO} pixels para baixo`);
        } else if (acao === 'cima') {
            await page.evaluate((pixels) => {
                const sectionRight = document.getElementById('sectionRight');
                if (sectionRight) {
                    sectionRight.scrollTop -= pixels;
                }
            }, PIXELS_POR_MOVIMENTO);
            console.log(`Loja movida ${PIXELS_POR_MOVIMENTO} pixels para cima`);
        } else if (acao === 'topo') {
            await page.evaluate(() => {
                const sectionRight = document.getElementById('sectionRight');
                const store = document.getElementById('store');
                if (sectionRight && store) {
                    // Calcula a posição do início do store em relação ao sectionRight
                    const storeRect = store.getBoundingClientRect();
                    const sectionRect = sectionRight.getBoundingClientRect();
                    const scrollPosition = storeRect.top - sectionRect.top + sectionRight.scrollTop;
                    sectionRight.scrollTop = scrollPosition;
                }
            });
            console.log('Loja movida para o topo');
        }
    } catch (err) {
        console.error('Erro ao controlar loja:', err);
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
        
        // Verifica se é um comando de controle da loja
        if (data.comment.toLowerCase() === 'loja baixo') {
            controlarLoja('baixo');
        } else if (data.comment.toLowerCase() === 'loja cima') {
            controlarLoja('cima');
        } else if (data.comment.toLowerCase() === 'loja topo') {
            controlarLoja('topo');
        } else if (data.comment.toLowerCase() === 'backup') {
            console.log(`Comando de backup recebido de ${data.uniqueId}`);
            cookieService.fazerBackupManual().then(() => {
                console.log('Backup manual concluído com sucesso!');
            }).catch(err => {
                console.error('Erro ao executar backup manual:', err);
            });
        } else {
            cookieService.comprarUpgrade(data.comment);
        }
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

// Função para calcular o tempo de espera com backoff exponencial
function calcularTempoEspera(tentativa) {
    const baseDelay = 5000; // 5 segundos base
    const maxDelay = 300000; // 5 minutos máximo
    const delay = Math.min(baseDelay * Math.pow(2, tentativa - 1), maxDelay);
    return delay;
}

// Função para conectar à live
async function conectarLive() {
    try {
        const agora = Date.now();
        const tempoDesdeUltimaTentativa = agora - ultimoTempoReconexao;
        
        // Se tentou reconectar muito recentemente, espera um pouco
        if (tempoDesdeUltimaTentativa < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - tempoDesdeUltimaTentativa));
        }
        
        console.log(`Tentando conectar à live do usuário: ${TIKTOK_USERNAME}`);
        
        // Verifica se já existe uma conexão ativa
        if (tiktokLiveConnection) {
            console.log('Desconectando conexão existente...');
            tiktokLiveConnection.disconnect();
            tiktokLiveConnection = null;
        }
        
        tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME);
        
        // Adiciona timeout para a conexão
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout ao conectar')), 30000);
        });
        
        const state = await Promise.race([
            tiktokLiveConnection.connect(),
            timeoutPromise
        ]);
        
        if (!state || !state.roomId) {
            throw new Error('Conexão estabelecida, mas não foi possível obter o ID da sala');
        }
        
        console.log(`Conectado à sala com ID ${state.roomId}`);
        console.log('Detalhes da sala:', {
            roomId: state.roomId,
            userId: state.userId,
            uniqueId: state.uniqueId,
            nickname: state.nickname
        });
        
        tentativasReconexao = 0;
        ultimoTempoReconexao = Date.now();
        configurarEventos();
        
    } catch (err) {
        console.error('Falha ao conectar:', err.message);
        console.error('Detalhes do erro:', err);
        
        // Verifica se é um erro de rate limit
        if (err.retryAfter) {
            const tempoEspera = Math.min(err.retryAfter * 1000, 300000); // Máximo de 5 minutos
            console.log(`Rate limit detectado. Esperando ${tempoEspera/1000} segundos antes de tentar novamente...`);
            await new Promise(resolve => setTimeout(resolve, tempoEspera));
            return conectarLive();
        }
        
        if (tentativasReconexao < MAX_TENTATIVAS) {
            tentativasReconexao++;
            const tempoEspera = calcularTempoEspera(tentativasReconexao);
            console.log(`Tentando reconectar em ${tempoEspera/1000} segundos... (Tentativa ${tentativasReconexao}/${MAX_TENTATIVAS})`);
            await new Promise(resolve => setTimeout(resolve, tempoEspera));
            return conectarLive();
        } else {
            console.log('Número máximo de tentativas atingido. Verifique se:');
            console.log('1. O usuário está em live');
            console.log('2. O nome de usuário está correto');
            console.log('3. Sua conexão com a internet está estável');
            console.log('4. Não há problemas com o servidor do TikTok');
            console.log('5. Você não está sendo bloqueado por rate limit');
            
            // Reseta as tentativas após um tempo
            setTimeout(() => {
                tentativasReconexao = 0;
                console.log('Resetando contador de tentativas. Tentando reconectar...');
                conectarLive();
            }, 300000); // 5 minutos
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