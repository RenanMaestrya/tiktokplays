const { WebcastPushConnection } = require('tiktok-live-connector');
const puppeteer = require('puppeteer');
const fs = require('fs');
const player = require('play-sound')(opts = {});

const tiktokUsername = 'maesttrya';
let tiktokLiveConnection = null;
let tentativasReconexao = 0;
const MAX_TENTATIVAS = 5;
const INTERVALO_RECONEXAO = 30000; // 30 segundos
let browser = null;
let page = null;

// Configurações de performance
const CLICKS_PER_BATCH = 50; // Número de cliques por lote
const BATCH_DELAY = 100; // Delay entre lotes em ms
const MAX_RETRIES = 3; // Número máximo de tentativas para operações

// URL da música Lofi (você pode substituir por qualquer URL de música Lofi 24h)
const LOFI_URL = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';

// Função para esperar um tempo específico
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para clicar no cookie de forma visível
async function clicarCookie(vezes) {
    try {
        const cookie = await page.$('#bigCookie');
        if (cookie) {
            for (let i = 0; i < vezes; i++) {
                await cookie.click();
                // Pequena pausa entre cliques para ser visível
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    } catch (err) {
        console.error('Erro ao clicar no cookie:', err);
    }
}

// Função para obter o último arquivo de backup
function obterUltimoBackup() {
    try {
        if (!fs.existsSync('backups')) {
            return null;
        }
        
        const arquivos = fs.readdirSync('backups');
        if (arquivos.length === 0) {
            return null;
        }
        
        return arquivos
            .map(arquivo => ({
                nome: arquivo,
                data: fs.statSync(`backups/${arquivo}`).mtime
            }))
            .sort((a, b) => b.data - a.data)[0].nome;
    } catch (err) {
        console.error('Erro ao obter último backup:', err);
        return null;
    }
}

// Função para fazer backup do salvamento
async function fazerBackup() {
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
            console.log('Iniciando backup do salvamento...');
            
            await page.click('.subButton');
            await page.waitForSelector('.option.smallFancyButton', { visible: true, timeout: 5000 });
            await page.click('a.option.smallFancyButton[onclick*="ExportSave"]');
            await page.waitForSelector('#textareaPrompt', { visible: true, timeout: 5000 });
            
            const saveData = await page.$eval('#textareaPrompt', el => el.value);
            
            if (!fs.existsSync('backups')) {
                fs.mkdirSync('backups');
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `backups/save_${timestamp}.txt`;
            
            fs.writeFileSync(fileName, saveData);
            console.log(`Backup salvo em: ${fileName}`);
            
            await page.keyboard.press('Escape');
            return;
            
        } catch (err) {
            console.error(`Tentativa ${retry + 1} de backup falhou:`, err);
            if (retry === MAX_RETRIES - 1) throw err;
            await delay(1000);
        }
    }
}

// Função para comprar upgrade
async function comprarUpgrade(nomeUpgrade) {
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
            if (nomeUpgrade.toLowerCase() === 'up') {
                const upgrades = await page.$$('.crate.upgrade.enabled');
                if (upgrades.length > 0) {
                    await upgrades[0].click();
                    console.log('Primeiro upgrade disponível comprado com sucesso!');
                    return;
                }
                console.log('Nenhum upgrade disponível para comprar');
                return;
            }
            
            const upgradeMatch = nomeUpgrade.match(/^up(\d+)$/i);
            if (upgradeMatch) {
                const upgradeIndex = parseInt(upgradeMatch[1]) - 1;
                const upgrades = await page.$$('.crate.upgrade.enabled');
                
                if (upgrades[upgradeIndex]) {
                    await upgrades[upgradeIndex].click();
                    console.log(`Upgrade ${upgradeIndex + 1} comprado com sucesso!`);
                    return;
                }
                console.log(`Upgrade ${upgradeIndex + 1} não encontrado ou não disponível`);
                return;
            }
            
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
            return;
            
        } catch (err) {
            console.error(`Tentativa ${retry + 1} de comprar upgrade falhou:`, err);
            if (retry === MAX_RETRIES - 1) throw err;
            await delay(1000);
        }
    }
}

// Função para processar gifts
async function processarGift(giftId) {
    try {
        const giftActions = {
            '1': { // Rose (presente comum)
                clicks: 100,
                message: 'Obrigado pelo Rose! 100 cliques no cookie!'
            },
            '2': { // Lion (presente médio)
                clicks: 500,
                upgrade: 'up1',
                message: 'Obrigado pelo Lion! 500 cliques e um upgrade!'
            },
            '3': { // Universe (presente caro)
                clicks: 1000,
                upgrade: 'up2',
                product: 'Cursor',
                message: 'Obrigado pelo Universe! 1000 cliques, upgrade e produto!'
            }
        };

        const action = giftActions[giftId];
        
        if (action) {
            // Executa os cliques de forma visível
            if (action.clicks) {
                await clicarCookie(action.clicks);
            }
            
            // Compra upgrade se especificado
            if (action.upgrade) {
                await comprarUpgrade(action.upgrade);
            }
            
            // Compra produto se especificado
            if (action.product) {
                await comprarUpgrade(action.product);
            }
            
            console.log(action.message);
        } else {
            // Ação padrão para gifts não mapeados
            await clicarCookie(50);
            console.log('Obrigado pelo presente! 50 cliques no cookie!');
        }
    } catch (err) {
        console.error('Erro ao processar gift:', err);
    }
}

// Função para inicializar o navegador
async function inicializarNavegador() {
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox'
            ]
        });
        
        page = await browser.newPage();
        
        // Desativa timeouts
        await page.setDefaultNavigationTimeout(0);
        await page.setDefaultTimeout(0);
        
        await page.goto('https://orteil.dashnet.org/cookieclicker/');
        
        // Tenta fechar a mensagem de cookies até 3 vezes
        for (let tentativa = 1; tentativa <= 3; tentativa++) {
            try {
                console.log(`Tentativa ${tentativa} de fechar o botão de cookies...`);
                await page.waitForSelector('.cc_btn_accept_all', { visible: true, timeout: 2000 });
                await page.click('.cc_btn_accept_all');
                console.log('Botão de cookies fechado com sucesso!');
                break;
            } catch (err) {
                console.log(`Tentativa ${tentativa} falhou:`, err.message);
                if (tentativa === 3) {
                    console.log('Não foi possível fechar o botão de cookies após 3 tentativas');
                } else {
                    await delay(1000); // Espera 1 segundo entre tentativas
                }
            }
        }
        
        // Seleciona o idioma PT-BR
        try {
            await page.waitForSelector('#langSelect-PT-BR', { visible: true });
            await page.click('#langSelect-PT-BR');
        } catch (err) {
            console.log('Botão de idioma não encontrado');
        }
        
        // Obtém o último backup
        const ultimoBackup = obterUltimoBackup();
        
        if (ultimoBackup) {
            const saveData = fs.readFileSync(`backups/${ultimoBackup}`, 'utf8');
            
            try {
                // Espera a página estar completamente carregada
                await page.waitForSelector('.subButton', { visible: true, timeout: 10000 });
                
                // Clica no botão de opções
                await page.click('.subButton');
                
                // Espera o menu de opções aparecer
                await page.waitForSelector('.option.smallFancyButton', { visible: true, timeout: 5000 });
                
                // Clica no botão de importar
                await page.click('a.option.smallFancyButton[onclick*="ImportSave"]');
                
                // Espera o textarea aparecer
                await page.waitForSelector('#textareaPrompt', { visible: true, timeout: 5000 });
                
                // Insere os dados do backup
                await page.evaluate((data) => {
                    const textarea = document.querySelector('#textareaPrompt');
                    if (textarea) {
                        textarea.value = data;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, saveData);
                
                // Espera o botão de confirmação aparecer
                await page.waitForSelector('#promptOption0', { visible: true, timeout: 5000 });
                
                // Clica no botão de confirmação
                await page.click('#promptOption0');
                
                // Espera um pouco para garantir que o salvamento foi carregado
                await delay(2000);
                
                console.log('Backup carregado com sucesso!');
            } catch (err) {
                console.error('Erro ao carregar backup:', err);
                console.log('Iniciando novo jogo...');
            }
        } else {
            console.log('Nenhum backup encontrado. Iniciando novo jogo.');
        }
        
    } catch (err) {
        console.error('Erro ao inicializar navegador:', err);
        throw err;
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

// Função para configurar os eventos da live
function configurarEventos() {
    tiktokLiveConnection.on('like', data => {
        console.log(`${data.uniqueId} deixou ${data.likeCount} likes`);
        clicarCookie(data.likeCount);
    });

    tiktokLiveConnection.on('chat', data => {
        console.log(`${data.uniqueId}: ${data.comment}`);
        comprarUpgrade(data.comment);
    });

    tiktokLiveConnection.on('gift', data => {
        console.log(`${data.uniqueId} enviou o presente ${data.giftId}`);
        processarGift(data.giftId);
    });

    tiktokLiveConnection.on('disconnected', async () => {
        console.log('Desconectado da live. Fazendo backup e tentando reconectar...');
        await fazerBackup();
        conectarLive();
    });
}

// Função para limpar recursos
async function limparRecursos() {
    try {
        if (page) {
            await page.close();
            page = null;
        }
        if (browser) {
            await browser.close();
            browser = null;
        }
        if (tiktokLiveConnection) {
            tiktokLiveConnection.disconnect();
            tiktokLiveConnection = null;
        }
    } catch (err) {
        console.error('Erro ao limpar recursos:', err);
    }
}

// Tratamento de sinais do sistema
process.on('SIGINT', async () => {
    console.log('Encerrando o programa...');
    await limparRecursos();
    process.exit();
});

process.on('uncaughtException', async (err) => {
    console.error('Erro não tratado:', err);
    await limparRecursos();
    process.exit(1);
});

// Função para tocar música Lofi
function tocarLofi() {
    try {
        player.play(LOFI_URL, (err) => {
            if (err) {
                console.error('Erro ao tocar música:', err);
                // Tenta novamente após 5 segundos
                setTimeout(tocarLofi, 5000);
            }
        });
    } catch (err) {
        console.error('Erro ao iniciar música:', err);
    }
}

// Inicia a conexão
console.log('Iniciando conexão com a live...');
inicializarNavegador().then(() => {
    conectarLive();
    tocarLofi(); // Inicia a música Lofi
});
