-- Controle da carga por arquivo: permite retomar lotes sem duplicar linhas.
CREATE TABLE IF NOT EXISTS importacaoCenso (
    arquivoSha256 CHAR(64) PRIMARY KEY,
    arquivo VARCHAR(255) NOT NULL,
    ultimaLinha INT NOT NULL DEFAULT 0,
    concluida BOOLEAN NOT NULL DEFAULT 0,
    totalRegistros INT NOT NULL DEFAULT 0,
    atualizadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índices não únicos: linhas com a mesma dimensão podem ser legítimas.
CREATE INDEX idx_localizacao_municipio ON localizacao (municipio);
CREATE INDEX idx_instituicao_codigo_local ON instituicao (codigoIes, fkLocalizacao);
CREATE INDEX idx_curso_busca_importacao ON curso (fkInstituicao, areaGeral, modalidadeEnsino);
CREATE INDEX idx_dadoscurso_ano_curso ON dadosCurso (anoCenso, fkCurso);
