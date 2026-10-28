package testes;

public class RegistroCenso {

    // Atributos (um para cada coluna da planilha)
    // Os atributos são "private": só podem ser acessados de fora pelos getters e setters.

    // Identificação do curso
    private Integer anoCenso;          // NU_ANO_CENSO
    private String municipio;          // NO_MUNICIPIO
    private Integer codigoIes;         // CO_IES (código da instituição de ensino superior)
    private String areaGeral;          // NO_CINE_AREA_GERAL
    private String areaEspecifica;     // NO_CINE_AREA_ESPECIFICA
    private Integer modalidadeEnsino;  // TP_MODALIDADE_ENSINO

    // Vagas, inscritos e ingressantes
    private Integer vagasTotal;        // QT_VG_TOTAL
    private Integer inscritosTotal;    // QT_INSCRITO_TOTAL
    private Integer ingressantes;      // QT_ING
    private Integer matriculas;        // QT_MAT

    // Matrículas separadas por faixa de idade
    private Integer mat0a17;           // QT_MAT_0_17
    private Integer mat18a24;          // QT_MAT_18_24
    private Integer mat25a29;          // QT_MAT_25_29
    private Integer mat30a34;          // QT_MAT_30_34
    private Integer mat35a39;          // QT_MAT_35_39
    private Integer mat40a49;          // QT_MAT_40_49
    private Integer mat50a59;          // QT_MAT_50_59
    private Integer mat60Mais;         // QT_MAT_60_MAIS

    // Quantidade de pessoas que concluíram o curso
    private Integer concluintes;       // QT_CONC

    public RegistroCenso() {
    }

    // É este que o LeitorExcel usa para montar cada registro.
    // A ordem dos parâmetros precisa ser a mesma ordem usada na chamada.
    public RegistroCenso(Integer anoCenso, String municipio, Integer codigoIes, String areaGeral,
                         String areaEspecifica, Integer modalidadeEnsino, Integer vagasTotal,
                         Integer inscritosTotal, Integer ingressantes, Integer matriculas,
                         Integer mat0a17, Integer mat18a24, Integer mat25a29, Integer mat30a34,
                         Integer mat35a39, Integer mat40a49, Integer mat50a59, Integer mat60Mais,
                         Integer concluintes) {
        this.anoCenso = anoCenso;
        this.municipio = municipio;
        this.codigoIes = codigoIes;
        this.areaGeral = areaGeral;
        this.areaEspecifica = areaEspecifica;
        this.modalidadeEnsino = modalidadeEnsino;
        this.vagasTotal = vagasTotal;
        this.inscritosTotal = inscritosTotal;
        this.ingressantes = ingressantes;
        this.matriculas = matriculas;
        this.mat0a17 = mat0a17;
        this.mat18a24 = mat18a24;
        this.mat25a29 = mat25a29;
        this.mat30a34 = mat30a34;
        this.mat35a39 = mat35a39;
        this.mat40a49 = mat40a49;
        this.mat50a59 = mat50a59;
        this.mat60Mais = mat60Mais;
        this.concluintes = concluintes;
    }

    // Getter = "pega" (lê) o valor do atributo.
    // Setter = "define" (altera) o valor do atributo.
    // Como os atributos são private, é por aqui que o resto do programa acessa os dados.

    public Integer getAnoCenso() { return anoCenso; }
    public void setAnoCenso(Integer anoCenso) { this.anoCenso = anoCenso; }

    public String getMunicipio() { return municipio; }
    public void setMunicipio(String municipio) { this.municipio = municipio; }

    public Integer getCodigoIes() { return codigoIes; }
    public void setCodigoIes(Integer codigoIes) { this.codigoIes = codigoIes; }

    public String getAreaGeral() { return areaGeral; }
    public void setAreaGeral(String areaGeral) { this.areaGeral = areaGeral; }

    public String getAreaEspecifica() { return areaEspecifica; }
    public void setAreaEspecifica(String areaEspecifica) { this.areaEspecifica = areaEspecifica; }

    public Integer getModalidadeEnsino() { return modalidadeEnsino; }
    public void setModalidadeEnsino(Integer modalidadeEnsino) { this.modalidadeEnsino = modalidadeEnsino; }

    public Integer getVagasTotal() { return vagasTotal; }
    public void setVagasTotal(Integer vagasTotal) { this.vagasTotal = vagasTotal; }

    public Integer getInscritosTotal() { return inscritosTotal; }
    public void setInscritosTotal(Integer inscritosTotal) { this.inscritosTotal = inscritosTotal; }

    public Integer getIngressantes() { return ingressantes; }
    public void setIngressantes(Integer ingressantes) { this.ingressantes = ingressantes; }

    public Integer getMatriculas() { return matriculas; }
    public void setMatriculas(Integer matriculas) { this.matriculas = matriculas; }

    public Integer getMat0a17() { return mat0a17; }
    public void setMat0a17(Integer mat0a17) { this.mat0a17 = mat0a17; }

    public Integer getMat18a24() { return mat18a24; }
    public void setMat18a24(Integer mat18a24) { this.mat18a24 = mat18a24; }

    public Integer getMat25a29() { return mat25a29; }
    public void setMat25a29(Integer mat25a29) { this.mat25a29 = mat25a29; }

    public Integer getMat30a34() { return mat30a34; }
    public void setMat30a34(Integer mat30a34) { this.mat30a34 = mat30a34; }

    public Integer getMat35a39() { return mat35a39; }
    public void setMat35a39(Integer mat35a39) { this.mat35a39 = mat35a39; }

    public Integer getMat40a49() { return mat40a49; }
    public void setMat40a49(Integer mat40a49) { this.mat40a49 = mat40a49; }

    public Integer getMat50a59() { return mat50a59; }
    public void setMat50a59(Integer mat50a59) { this.mat50a59 = mat50a59; }

    public Integer getMat60Mais() { return mat60Mais; }
    public void setMat60Mais(Integer mat60Mais) { this.mat60Mais = mat60Mais; }

    public Integer getConcluintes() { return concluintes; }
    public void setConcluintes(Integer concluintes) { this.concluintes = concluintes; }

    // toString define como o objeto aparece quando fazemos System.out.println(registro).
    // Sem ele, o Java mostraria algo ilegível como "testes.RegistroCenso@1a2b3c".
    @Override
    public String toString() {
        return "RegistroCenso{" +
                "anoCenso=" + anoCenso +
                ", municipio='" + municipio + '\'' +
                ", codigoIes=" + codigoIes +
                ", areaGeral='" + areaGeral + '\'' +
                ", areaEspecifica='" + areaEspecifica + '\'' +
                ", modalidadeEnsino=" + modalidadeEnsino +
                ", vagasTotal=" + vagasTotal +
                ", inscritosTotal=" + inscritosTotal +
                ", ingressantes=" + ingressantes +
                ", matriculas=" + matriculas +
                ", mat0a17=" + mat0a17 +
                ", mat18a24=" + mat18a24 +
                ", mat25a29=" + mat25a29 +
                ", mat30a34=" + mat30a34 +
                ", mat35a39=" + mat35a39 +
                ", mat40a49=" + mat40a49 +
                ", mat50a59=" + mat50a59 +
                ", mat60Mais=" + mat60Mais +
                ", concluintes=" + concluintes +
                '}';
    }
}