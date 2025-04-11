const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class MusicService {
    constructor() {
        this.musicFiles = [];
        this.currentMusicIndex = 0;
        this.isPlaying = false;
        this.player = null;
        this.volume = 0.3;
    }

    async initialize() {
        try {
            const soundsDir = path.join(__dirname, '../../../sounds');
            this.musicFiles = fs.readdirSync(soundsDir)
                .filter(file => file.endsWith('.mp3'))
                .map(file => path.join(soundsDir, file));

            if (this.musicFiles.length === 0) {
                console.log('Nenhum arquivo de música encontrado na pasta sounds');
                return;
            }

            // Embaralha as músicas
            this.shuffleMusic();
            console.log(`${this.musicFiles.length} músicas carregadas com sucesso`);
        } catch (error) {
            console.error('Erro ao inicializar serviço de música:', error);
        }
    }

    shuffleMusic() {
        for (let i = this.musicFiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.musicFiles[i], this.musicFiles[j]] = [this.musicFiles[j], this.musicFiles[i]];
        }
    }

    playNext() {
        if (this.musicFiles.length === 0) return;

        if (this.currentMusicIndex >= this.musicFiles.length) {
            this.currentMusicIndex = 0;
            this.shuffleMusic();
        }

        const musicFile = this.musicFiles[this.currentMusicIndex];
        

        if (this.player) {
            this.player.kill();
        }

        this.player = exec(`afplay -v ${this.volume} "${musicFile}"`, (error) => {
            if (error) {
                console.error('Erro ao reproduzir música:', error);
            }
            this.currentMusicIndex++;
            this.playNext();
        });

        this.isPlaying = true;
    }

    start() {
        if (!this.isPlaying) {
            this.playNext();
        }
    }

    stop() {
        if (this.player) {
            this.player.kill();
            this.player = null;
        }
        this.isPlaying = false;
    }
}

module.exports = new MusicService(); 