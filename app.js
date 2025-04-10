const { WebcastPushConnection } = require('tiktok-live-connector');
const robot = require("robotjs");

const tiktokUsername = 'maesttrya';
let tiktokLiveConnection = null;
let tentativasReconexao = 0;
const MAX_TENTATIVAS = 5;
const INTERVALO_RECONEXAO = 30000; // 30 segundos



// Função para conectar à live
async function conectarLive() {
    try {
        tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);
        
        const state = await tiktokLiveConnection.connect();
        console.log(`Conectado à sala com ID ${state.roomId}`);
        tentativasReconexao = 0; // Reseta o contador de tentativas
        
        // Configura os eventos após conexão bem-sucedida
        configurarEventos();
        
    } catch (err) {
        console.error('Falha ao conectar:', err.message);
        
        if (tentativasReconexao < MAX_TENTATIVAS) {
            tentativasReconexao++;
            console.log(`Tentando reconectar em ${INTERVALO_RECONEXAO/1000} segundos... (Tentativa ${tentativasReconexao}/${MAX_TENTATIVAS})`);
            setTimeout(conectarLive, INTERVALO_RECONEXAO);
        } else {
            console.log('Número máximo de tentativas atingido. Verifique se a live está online.');
        }
    }
}

// Função para configurar os eventos da live
function configurarEventos() {
    // Quando um espectador enviar uma curtida
    tiktokLiveConnection.on('like', data => {
        console.log(`${data.uniqueId} deixou ${data.likeCount} likes`);

        for (let i = 0; i < data.likeCount; i++) {
            robot.moveMouse(180, 420);
            robot.mouseClick();
        }
    });

    // Evento de desconexão
    tiktokLiveConnection.on('disconnected', () => {
        console.log('Desconectado da live. Tentando reconectar...');
        conectarLive();
    });
}

// Inicia a conexão
console.log('Iniciando conexão com a live...');
conectarLive();

// Quando um espectador enviar um presente
// tiktokLiveConnection.on('gift', data => {
//     console.log(`${data.uniqueId} enviou o presente ${data.giftId}`);

//     // Exemplo: clicar 5 vezes se for presente
//     for (let i = 0; i < 5; i++) {
//         robot.moveMouse(100, 500);
//         robot.mouseClick();
//     }
// });
