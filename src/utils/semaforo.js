class Semaforo {
    constructor() {
        this.estaBloqueado = false;
        this.fila = [];
    }

    async executarComPrioridade(funcao) {
        if (this.estaBloqueado) {
            return new Promise((resolve) => {
                this.fila.push({ funcao, resolve });
            });
        }

        this.estaBloqueado = true;
        try {
            const resultado = await funcao();
            return resultado;
        } finally {
            this.estaBloqueado = false;
            this.processarFila();
        }
    }

    async executar(funcao) {
        if (this.estaBloqueado) {
            return new Promise((resolve) => {
                this.fila.push({ funcao, resolve });
            });
        }

        try {
            const resultado = await funcao();
            return resultado;
        } finally {
            this.processarFila();
        }
    }

    async processarFila() {
        if (this.fila.length > 0 && !this.estaBloqueado) {
            const { funcao, resolve } = this.fila.shift();
            try {
                const resultado = await funcao();
                resolve(resultado);
            } catch (erro) {
                resolve(Promise.reject(erro));
            }
        }
    }
}

module.exports = new Semaforo(); 