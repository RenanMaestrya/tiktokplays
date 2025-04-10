const { WebcastPushConnection } = require('tiktok-live-connector');
const puppeteer = require('puppeteer');

const tiktokUsername = 'emersoncglobal';
let tiktokLiveConnection = null;
let tentativasReconexao = 0;
const MAX_TENTATIVAS = 5;
const INTERVALO_RECONEXAO = 30000; // 30 segundos
let browser = null;
let page = null;

// Função para inicializar o navegador
async function inicializarNavegador() {
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
        });
        page = await browser.newPage();
        await page.goto('https://orteil.dashnet.org/cookieclicker/');
        console.log('Navegador inicializado e site carregado');
    } catch (err) {
        console.error('Erro ao inicializar navegador:', err);
    }
}

// Função para conectar à live
async function conectarLive() {
    try {
        tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);
        
        const state = await tiktokLiveConnection.connect();
        console.log(`Conectado à sala com ID ${state.roomId}`);
        tentativasReconexao = 0;
        
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

// Função para clicar no cookie
async function clicarCookie(vezes) {
    try {
        for (let i = 0; i < vezes; i++) {
            await page.click('#bigCookie');
        }
    } catch (err) {
        console.error('Erro ao clicar no cookie:', err);
    }
}

// Função para comprar upgrade
async function comprarUpgrade(nomeUpgrade) {
    try {
        // Verifica se é um comando de upgrade (up1, up2, etc)
        const upgradeMatch = nomeUpgrade.match(/^up(\d+)$/i);
        
        if (upgradeMatch) {
            const upgradeIndex = parseInt(upgradeMatch[1]) - 1; // Converte para índice base 0
            const upgrades = await page.$$('.crate.upgrade.enabled');
            
            if (upgrades[upgradeIndex]) {
                await upgrades[upgradeIndex].click();
                console.log(`Upgrade ${upgradeIndex + 1} comprado com sucesso!`);
                return;
            } else {
                console.log(`Upgrade ${upgradeIndex + 1} não encontrado ou não disponível`);
                return;
            }
        }
        
        // Se não for comando de upgrade, tenta comprar produto
        const produtos = await page.$$('.product.unlocked.enabled');
        
        for (const produto of produtos) {
            const nome = await produto.$eval('.productName', el => el.textContent.trim());
            
            if (nome.toLowerCase() === nomeUpgrade.toLowerCase()) {
                await produto.click();
                console.log(`Produto ${nomeUpgrade} comprado com sucesso!`);
                return;
            }
        }
        
        console.log(`${nomeUpgrade} não encontrado ou não disponível`);
    } catch (err) {
        console.error('Erro ao comprar upgrade:', err);
    }
}

// Função para configurar os eventos da live
function configurarEventos() {
    // Quando um espectador enviar uma curtida
    tiktokLiveConnection.on('like', data => {
        console.log(`${data.uniqueId} deixou ${data.likeCount} likes`);
        clicarCookie(data.likeCount);
    });

    // Quando um espectador enviar uma mensagem
    tiktokLiveConnection.on('chat', data => {
        console.log(`${data.uniqueId}: ${data.comment}`);
        comprarUpgrade(data.comment);
    });

    // Evento de desconexão
    tiktokLiveConnection.on('disconnected', () => {
        console.log('Desconectado da live. Tentando reconectar...');
        conectarLive();
    });
}

// Inicia a conexão
console.log('Iniciando conexão com a live...');
inicializarNavegador().then(() => {
    conectarLive();
});

// Quando um espectador enviar um presente
// tiktokLiveConnection.on('gift', data => {
//     console.log(`${data.uniqueId} enviou o presente ${data.giftId}`);

//     // Exemplo: clicar 5 vezes se for presente
//     for (let i = 0; i < 5; i++) {
//         robot.moveMouse(100, 500);
//         robot.mouseClick();
//     }
// });
