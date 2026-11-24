package testes;

public class DistribuicaoEtaria {

    private Integer mat0a17;
    private Integer mat18a24;
    private Integer mat25a29;
    private Integer mat30a34;
    private Integer mat35a39;
    private Integer mat40a49;
    private Integer mat50a59;
    private Integer mat60Mais;

    public DistribuicaoEtaria() {
    }

    public DistribuicaoEtaria(Integer mat0a17, Integer mat18a24, Integer mat25a29,
                              Integer mat30a34, Integer mat35a39, Integer mat40a49,
                              Integer mat50a59, Integer mat60Mais) {
        this.mat0a17 = mat0a17;
        this.mat18a24 = mat18a24;
        this.mat25a29 = mat25a29;
        this.mat30a34 = mat30a34;
        this.mat35a39 = mat35a39;
        this.mat40a49 = mat40a49;
        this.mat50a59 = mat50a59;
        this.mat60Mais = mat60Mais;
    }

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

    @Override
    public String toString() {
        return "DistribuicaoEtaria{" +
                "mat0a17=" + mat0a17 +
                ", mat18a24=" + mat18a24 +
                ", mat25a29=" + mat25a29 +
                ", mat30a34=" + mat30a34 +
                ", mat35a39=" + mat35a39 +
                ", mat40a49=" + mat40a49 +
                ", mat50a59=" + mat50a59 +
                ", mat60Mais=" + mat60Mais +
                '}';
    }
}