package testes;

public class RegistroCenso {

    private Integer anoCenso;
    private String municipio;
    private Integer codigoIes;
    private String areaGeral;
    private String areaEspecifica;
    private Integer modalidadeEnsino;

    private Integer vagasTotal;
    private Integer inscritosTotal;
    private Integer ingressantes;
    private Integer matriculas;
    private Integer concluintes;

    private final DistribuicaoEtaria distribuicaoEtaria;

    public RegistroCenso() {
        this.distribuicaoEtaria = new DistribuicaoEtaria();
    }

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
        this.concluintes = concluintes;
        this.distribuicaoEtaria = new DistribuicaoEtaria(
                mat0a17, mat18a24, mat25a29, mat30a34,
                mat35a39, mat40a49, mat50a59, mat60Mais
        );
    }

    public DistribuicaoEtaria getDistribuicaoEtaria() {
        return distribuicaoEtaria;
    }

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

    public Integer getConcluintes() { return concluintes; }
    public void setConcluintes(Integer concluintes) { this.concluintes = concluintes; }

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
                ", concluintes=" + concluintes +
                ", " + distribuicaoEtaria +
                '}';
    }
}