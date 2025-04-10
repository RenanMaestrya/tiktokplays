const { WebcastPushConnection } = require('tiktok-live-connector');
const robot = require("robotjs");

const tiktokUsername = 'animes.aleator1os';
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

// Função para capturar cliques do mouse
function capturarClique() {
    console.log('Clique em qualquer lugar da tela para ver as coordenadas...');
    robot.setMouseDelay(0);
    
    // Captura a posição do mouse quando o botão esquerdo é pressionado
    robot.mouseToggle("down", "left");
    const posicao = robot.getMousePos();
    console.log(`Você clicou em: X:${posicao.x}, Y:${posicao.y}`);
    robot.mouseToggle("up", "left");
}

// Conecta na live
tiktokLiveConnection.connect().then(state => {
    console.log(`Conectado à sala com ID ${state.roomId}`);
    capturarClique(); // Inicia a captura de cliques
}).catch(err => {
    console.error('Falha ao conectar', err);
});

// Quando um espectador enviar uma curtida
tiktokLiveConnection.on('like', data => {
    console.log(`${data.uniqueId} deixou ${data.likeCount} likes`);

    // Clica uma vez na posição X:150, Y:400 (ajuste se necessário)
    for (let i = 0; i < data.likeCount; i++) {
        const mousePos = robot.getMousePos();
        console.log(`Posição do mouse: X:${mousePos.x}, Y:${mousePos.y}`);
        robot.moveMouse(180, 420);
        robot.mouseClick();
    }
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
