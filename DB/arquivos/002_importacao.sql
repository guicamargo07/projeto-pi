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
SET @indice_existe = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND index_name = 'idx_localizacao_municipio');
SET @sql_indice = IF(@indice_existe = 0,
    'CREATE INDEX idx_localizacao_municipio ON localizacao (municipio)', 'SELECT 1');
PREPARE stmt_indice FROM @sql_indice;
EXECUTE stmt_indice;
DEALLOCATE PREPARE stmt_indice;

SET @indice_existe = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND index_name = 'idx_instituicao_codigo_local');
SET @sql_indice = IF(@indice_existe = 0,
    'CREATE INDEX idx_instituicao_codigo_local ON instituicao (codigoIes, fkLocalizacao)', 'SELECT 1');
PREPARE stmt_indice FROM @sql_indice;
EXECUTE stmt_indice;
DEALLOCATE PREPARE stmt_indice;

SET @indice_existe = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND index_name = 'idx_curso_busca_importacao');
SET @sql_indice = IF(@indice_existe = 0,
    'CREATE INDEX idx_curso_busca_importacao ON curso (fkInstituicao, areaGeral, modalidadeEnsino)', 'SELECT 1');
PREPARE stmt_indice FROM @sql_indice;
EXECUTE stmt_indice;
DEALLOCATE PREPARE stmt_indice;

SET @indice_existe = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND index_name = 'idx_dadoscurso_ano_curso');
SET @sql_indice = IF(@indice_existe = 0,
    'CREATE INDEX idx_dadoscurso_ano_curso ON dadosCurso (anoCenso, fkCurso)', 'SELECT 1');
PREPARE stmt_indice FROM @sql_indice;
EXECUTE stmt_indice;
DEALLOCATE PREPARE stmt_indice;
