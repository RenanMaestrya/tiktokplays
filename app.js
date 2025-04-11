const puppeteer = require('puppeteer');
const fs = require('fs');
const { delay, obterUltimoBackup } = require('./src/utils/helpers');
const cookieService = require('./src/services/cookie/cookieService');
const tiktokService = require('./src/services/tiktok/tiktokService');

let browser = null;

// Função para lidar com erros e fazer backup
async function handleError(err) {
    console.error('Erro detectado:', err);
    try {
        await cookieService.fazerBackup();
        console.log('Backup realizado com sucesso após erro');
    } catch (backupErr) {
        console.error('Erro ao tentar fazer backup após erro:', backupErr);
    }
    
    await limparRecursos();
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
        
        browser.on('disconnected', async () => {
            console.log('Browser desconectado inesperadamente');
            await handleError(new Error('Browser desconectado'));
        });
        
        const page = await browser.newPage();
        cookieService.setPage(page);
        
        await page.setDefaultNavigationTimeout(0);
        await page.setDefaultTimeout(0);
        
        await page.goto('https://orteil.dashnet.org/cookieclicker/');
        
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
                    await delay(1000);
                }
            }
        }
        
        try {
            await page.waitForSelector('#langSelect-PT-BR', { visible: true });
            await page.click('#langSelect-PT-BR');
        } catch (err) {
            console.log('Botão de idioma não encontrado');
        }
        
        const ultimoBackup = obterUltimoBackup();
        
        if (ultimoBackup) {
            const saveData = fs.readFileSync(`backups/${ultimoBackup}`, 'utf8');
            
            try {
                await page.waitForSelector('.subButton', { visible: true, timeout: 10000 });
                await page.click('.subButton');
                await page.waitForSelector('.option.smallFancyButton', { visible: true, timeout: 5000 });
                await page.click('a.option.smallFancyButton[onclick*="ImportSave"]');
                await page.waitForSelector('#textareaPrompt', { visible: true, timeout: 5000 });
                
                await page.evaluate((data) => {
                    const textarea = document.querySelector('#textareaPrompt');
                    if (textarea) {
                        textarea.value = data;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, saveData);
                
                await page.waitForSelector('#promptOption0', { visible: true, timeout: 5000 });
                await page.click('#promptOption0');
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
        await handleError(err);
        throw err;
    }
}

// Função para limpar recursos
async function limparRecursos() {
    try {
        if (browser) {
            await browser.close();
            browser = null;
        }
        tiktokService.desconectarLive();
    } catch (err) {
        console.error('Erro ao limpar recursos:', err);
    }
}

// Inicia a conexão
console.log('Iniciando conexão com a live...');
inicializarNavegador().then(() => {
    tiktokService.conectarLive();
    cookieService.iniciarBackupAutomatico();
});

// Adiciona limpeza do backup automático ao encerrar o programa
process.on('SIGINT', async () => {
    console.log('Encerrando o programa...');
    cookieService.pararBackupAutomatico();
    await handleError(new Error('Programa encerrado pelo usuário'));
    process.exit();
});

process.on('uncaughtException', async (err) => {
    console.error('Erro não tratado:', err);
    cookieService.pararBackupAutomatico();
    await handleError(err);
    process.exit(1);
}); 