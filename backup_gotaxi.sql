--
-- PostgreSQL database dump
--

\restrict P1mcDNXZY2XsVWvLP8MQ9f9cLgj2BYCrB3k4Iwboufr8fZwW5CJFhIyk8SPIfvZ

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: afiliado_comissoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.afiliado_comissoes (
    id integer NOT NULL,
    afiliado_id integer NOT NULL,
    indicado_id integer,
    tipo_evento character varying(50) DEFAULT 'pedido'::character varying NOT NULL,
    valor_transacao numeric(10,2) DEFAULT 0 NOT NULL,
    percentual numeric(5,2) DEFAULT 10 NOT NULL,
    valor_comissao numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    referencia_id integer,
    descricao text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.afiliado_comissoes OWNER TO postgres;

--
-- Name: afiliado_comissoes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.afiliado_comissoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.afiliado_comissoes_id_seq OWNER TO postgres;

--
-- Name: afiliado_comissoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.afiliado_comissoes_id_seq OWNED BY public.afiliado_comissoes.id;


--
-- Name: afiliado_indicacoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.afiliado_indicacoes (
    id integer NOT NULL,
    afiliado_id integer NOT NULL,
    usuario_indicado_id integer,
    nome_indicado character varying(255),
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    bonus_valor numeric(10,2) DEFAULT 10.00 NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    tipo_indicado character varying(20) DEFAULT 'usuario'::character varying,
    tipo_dispositivo character varying(20),
    email_indicado character varying(255)
);


ALTER TABLE public.afiliado_indicacoes OWNER TO postgres;

--
-- Name: afiliado_indicacoes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.afiliado_indicacoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.afiliado_indicacoes_id_seq OWNER TO postgres;

--
-- Name: afiliado_indicacoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.afiliado_indicacoes_id_seq OWNED BY public.afiliado_indicacoes.id;


--
-- Name: afiliado_resgates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.afiliado_resgates (
    id integer NOT NULL,
    afiliado_id integer NOT NULL,
    valor numeric(10,2) NOT NULL,
    chave_pix character varying(255),
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    observacao text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    processado_em timestamp without time zone,
    processado_por character varying(100)
);


ALTER TABLE public.afiliado_resgates OWNER TO postgres;

--
-- Name: afiliado_resgates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.afiliado_resgates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.afiliado_resgates_id_seq OWNER TO postgres;

--
-- Name: afiliado_resgates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.afiliado_resgates_id_seq OWNED BY public.afiliado_resgates.id;


--
-- Name: afiliados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.afiliados (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    saldo numeric(10,2) DEFAULT 0 NOT NULL,
    total_indicados integer DEFAULT 0 NOT NULL,
    total_ganhos numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'ativo'::character varying NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    percentual_comissao numeric(5,2) DEFAULT 10 NOT NULL,
    chave_pix character varying(255),
    tipo_pessoa character varying(20) DEFAULT 'fisica'::character varying,
    banco_nome character varying(100),
    total_comissoes numeric(10,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.afiliados OWNER TO postgres;

--
-- Name: afiliados_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.afiliados_config (
    id integer NOT NULL,
    percentual_comissao numeric(5,2) DEFAULT 10 NOT NULL,
    valor_minimo_saque numeric(10,2) DEFAULT 50 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_por character varying(100)
);


ALTER TABLE public.afiliados_config OWNER TO postgres;

--
-- Name: afiliados_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.afiliados_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.afiliados_config_id_seq OWNER TO postgres;

--
-- Name: afiliados_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.afiliados_config_id_seq OWNED BY public.afiliados_config.id;


--
-- Name: afiliados_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.afiliados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.afiliados_id_seq OWNER TO postgres;

--
-- Name: afiliados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.afiliados_id_seq OWNED BY public.afiliados.id;


--
-- Name: agendamentos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agendamentos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    categoria_id integer,
    cliente_nome text NOT NULL,
    cliente_telefone text,
    servico_nome text NOT NULL,
    prestador_nome text,
    data_hora timestamp without time zone NOT NULL,
    status text DEFAULT 'agendado'::text NOT NULL,
    valor real,
    observacoes text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    prestador_id integer,
    catalogo_id integer,
    valor_pago numeric(10,2),
    pago_em timestamp without time zone,
    metodo_pagamento text,
    comissao_gotaxi numeric(10,2)
);


ALTER TABLE public.agendamentos OWNER TO postgres;

--
-- Name: agendamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.agendamentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agendamentos_id_seq OWNER TO postgres;

--
-- Name: agendamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.agendamentos_id_seq OWNED BY public.agendamentos.id;


--
-- Name: carona_paradas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carona_paradas (
    id integer NOT NULL,
    carona_id integer NOT NULL,
    cidade character varying(200) NOT NULL,
    hora_prevista time without time zone,
    ordem integer DEFAULT 0 NOT NULL,
    aceita_embarque boolean DEFAULT true,
    aceita_desembarque boolean DEFAULT true
);


ALTER TABLE public.carona_paradas OWNER TO postgres;

--
-- Name: carona_paradas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.carona_paradas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carona_paradas_id_seq OWNER TO postgres;

--
-- Name: carona_paradas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carona_paradas_id_seq OWNED BY public.carona_paradas.id;


--
-- Name: carona_reservas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carona_reservas (
    id integer NOT NULL,
    carona_id integer NOT NULL,
    passageiro_nome character varying(200) NOT NULL,
    passageiro_telefone character varying(30),
    passageiro_cpf character varying(20),
    parada_embarque character varying(200),
    parada_desembarque character varying(200),
    valor numeric(10,2) DEFAULT 0 NOT NULL,
    forma_pagamento character varying(30) DEFAULT 'pix'::character varying,
    status character varying(20) DEFAULT 'confirmada'::character varying,
    observacoes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.carona_reservas OWNER TO postgres;

--
-- Name: carona_reservas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.carona_reservas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carona_reservas_id_seq OWNER TO postgres;

--
-- Name: carona_reservas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carona_reservas_id_seq OWNED BY public.carona_reservas.id;


--
-- Name: carona_veiculos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carona_veiculos (
    id integer NOT NULL,
    empresa_id integer,
    modelo character varying(120) NOT NULL,
    placa character varying(20),
    ano integer,
    cor character varying(60),
    vagas integer DEFAULT 4 NOT NULL,
    combustivel character varying(20) DEFAULT 'gasolina'::character varying,
    consumo_km_l numeric(6,2) DEFAULT 10,
    observacoes text,
    ativo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.carona_veiculos OWNER TO postgres;

--
-- Name: carona_veiculos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.carona_veiculos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carona_veiculos_id_seq OWNER TO postgres;

--
-- Name: carona_veiculos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carona_veiculos_id_seq OWNED BY public.carona_veiculos.id;


--
-- Name: caronas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.caronas (
    id integer NOT NULL,
    empresa_id integer,
    veiculo_id integer,
    origem character varying(200) NOT NULL,
    destino character varying(200) NOT NULL,
    distancia_km integer,
    data_viagem date NOT NULL,
    hora_partida time without time zone NOT NULL,
    vagas_total integer DEFAULT 3 NOT NULL,
    vagas_ocupadas integer DEFAULT 0,
    valor_por_vaga numeric(10,2) DEFAULT 0 NOT NULL,
    tipo character varying(20) DEFAULT 'com_paradas'::character varying,
    status character varying(20) DEFAULT 'ativa'::character varying,
    observacoes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.caronas OWNER TO postgres;

--
-- Name: caronas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.caronas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.caronas_id_seq OWNER TO postgres;

--
-- Name: caronas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.caronas_id_seq OWNED BY public.caronas.id;


--
-- Name: categorias_corrida; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias_corrida (
    id integer NOT NULL,
    nome text NOT NULL,
    taxa_minima real DEFAULT 5 NOT NULL,
    taxa_por_km real DEFAULT 2.5 NOT NULL,
    dist_chamada_km real DEFAULT 5 NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categorias_corrida OWNER TO postgres;

--
-- Name: categorias_corrida_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_corrida_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_corrida_id_seq OWNER TO postgres;

--
-- Name: categorias_corrida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_corrida_id_seq OWNED BY public.categorias_corrida.id;


--
-- Name: categorias_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    ordem integer DEFAULT 0,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categorias_pdv OWNER TO postgres;

--
-- Name: categorias_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_pdv_id_seq OWNER TO postgres;

--
-- Name: categorias_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_pdv_id_seq OWNED BY public.categorias_pdv.id;


--
-- Name: categorias_servicos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias_servicos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    icone text,
    cor text
);


ALTER TABLE public.categorias_servicos OWNER TO postgres;

--
-- Name: categorias_servicos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_servicos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_servicos_id_seq OWNER TO postgres;

--
-- Name: categorias_servicos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_servicos_id_seq OWNED BY public.categorias_servicos.id;


--
-- Name: chat_conversas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_conversas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    cliente_nome text DEFAULT 'Cliente'::text NOT NULL,
    cliente_token text,
    ultima_mensagem text,
    ultima_at timestamp with time zone DEFAULT now(),
    nao_lidas_loja integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.chat_conversas OWNER TO postgres;

--
-- Name: chat_conversas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_conversas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_conversas_id_seq OWNER TO postgres;

--
-- Name: chat_conversas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_conversas_id_seq OWNED BY public.chat_conversas.id;


--
-- Name: chat_mensagens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_mensagens (
    id integer NOT NULL,
    conversa_id integer NOT NULL,
    remetente text NOT NULL,
    mensagem text NOT NULL,
    lida boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_mensagens_remetente_check CHECK ((remetente = ANY (ARRAY['cliente'::text, 'loja'::text])))
);


ALTER TABLE public.chat_mensagens OWNER TO postgres;

--
-- Name: chat_mensagens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_mensagens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_mensagens_id_seq OWNER TO postgres;

--
-- Name: chat_mensagens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_mensagens_id_seq OWNED BY public.chat_mensagens.id;


--
-- Name: compras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compras (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    fornecedor_id integer,
    fornecedor_nome text DEFAULT ''::text NOT NULL,
    data_compra date DEFAULT CURRENT_DATE NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pago'::text NOT NULL,
    observacoes text,
    lancamento_id integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT compras_status_check CHECK ((status = ANY (ARRAY['pago'::text, 'pendente'::text, 'cancelado'::text])))
);


ALTER TABLE public.compras OWNER TO postgres;

--
-- Name: compras_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.compras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.compras_id_seq OWNER TO postgres;

--
-- Name: compras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.compras_id_seq OWNED BY public.compras.id;


--
-- Name: compras_itens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compras_itens (
    id integer NOT NULL,
    compra_id integer NOT NULL,
    produto character varying(200) NOT NULL,
    quantidade numeric(10,3) DEFAULT 1 NOT NULL,
    unidade character varying(20) DEFAULT 'un'::character varying NOT NULL,
    valor_unitario numeric(12,2) DEFAULT 0 NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.compras_itens OWNER TO postgres;

--
-- Name: compras_itens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.compras_itens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.compras_itens_id_seq OWNER TO postgres;

--
-- Name: compras_itens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.compras_itens_id_seq OWNED BY public.compras_itens.id;


--
-- Name: config_ecommerce_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.config_ecommerce_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    venda_local_ativo boolean DEFAULT true NOT NULL,
    raio_km integer DEFAULT 15 NOT NULL,
    venda_nacional_ativo boolean DEFAULT false NOT NULL,
    jadlog_contrato text,
    jadlog_senha text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.config_ecommerce_pdv OWNER TO postgres;

--
-- Name: config_ecommerce_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.config_ecommerce_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.config_ecommerce_pdv_id_seq OWNER TO postgres;

--
-- Name: config_ecommerce_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.config_ecommerce_pdv_id_seq OWNED BY public.config_ecommerce_pdv.id;


--
-- Name: config_entrega_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.config_entrega_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo character varying(10) DEFAULT 'fixa'::character varying NOT NULL,
    taxa_fixa numeric(10,2) DEFAULT 5.00 NOT NULL,
    taxa_por_km numeric(10,2) DEFAULT 2.00 NOT NULL,
    km_minimo numeric(10,2) DEFAULT 0 NOT NULL,
    raio_max_km numeric(10,2) DEFAULT 15 NOT NULL,
    taxa_minima numeric(10,2) DEFAULT 5.00 NOT NULL,
    endereco_restaurante text,
    lat_restaurante numeric(10,8),
    lng_restaurante numeric(11,8),
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL,
    timeline_ativo boolean DEFAULT true,
    raio_motoboy_km numeric(6,2) DEFAULT 5
);


ALTER TABLE public.config_entrega_pdv OWNER TO postgres;

--
-- Name: config_entrega_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.config_entrega_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.config_entrega_pdv_id_seq OWNER TO postgres;

--
-- Name: config_entrega_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.config_entrega_pdv_id_seq OWNED BY public.config_entrega_pdv.id;


--
-- Name: config_pagamento_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.config_pagamento_pdv (
    empresa_id integer NOT NULL,
    metodos text[] DEFAULT '{}'::text[] NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.config_pagamento_pdv OWNER TO postgres;

--
-- Name: configuracoes_plataforma; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracoes_plataforma (
    id integer NOT NULL,
    taxa_repasse numeric(5,2) DEFAULT 3.00 NOT NULL,
    chave_pix character varying(255),
    tipo_chave_pix character varying(50) DEFAULT 'aleatoria'::character varying,
    nome_beneficiario character varying(255),
    dia_vencimento integer DEFAULT 1 NOT NULL,
    hora_vencimento character varying(5) DEFAULT '18:00'::character varying NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now(),
    whatsapp_suporte character varying(20) DEFAULT '5511900000000'::character varying,
    raio_busca_motorista_km numeric(6,2) DEFAULT 10
);


ALTER TABLE public.configuracoes_plataforma OWNER TO postgres;

--
-- Name: configuracoes_plataforma_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuracoes_plataforma_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracoes_plataforma_id_seq OWNER TO postgres;

--
-- Name: configuracoes_plataforma_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuracoes_plataforma_id_seq OWNED BY public.configuracoes_plataforma.id;


--
-- Name: configuracoes_sistema; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracoes_sistema (
    chave character varying(100) NOT NULL,
    valor text DEFAULT ''::text NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.configuracoes_sistema OWNER TO postgres;

--
-- Name: corrida_mensagens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.corrida_mensagens (
    id integer NOT NULL,
    corrida_id integer NOT NULL,
    remetente text NOT NULL,
    texto text NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT corrida_mensagens_remetente_check CHECK ((remetente = ANY (ARRAY['passageiro'::text, 'motorista'::text])))
);


ALTER TABLE public.corrida_mensagens OWNER TO postgres;

--
-- Name: corrida_mensagens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.corrida_mensagens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corrida_mensagens_id_seq OWNER TO postgres;

--
-- Name: corrida_mensagens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.corrida_mensagens_id_seq OWNED BY public.corrida_mensagens.id;


--
-- Name: corridas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.corridas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    passageiro_nome text NOT NULL,
    passageiro_telefone text,
    origem_endereco text NOT NULL,
    destino_endereco text NOT NULL,
    status text DEFAULT 'aguardando'::text NOT NULL,
    valor real NOT NULL,
    distancia_km real,
    motorista_nome text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    tipo_veiculo text DEFAULT 'economico'::text,
    forma_pagamento text DEFAULT 'dinheiro'::text,
    lat_origem real,
    lng_origem real,
    lat_destino real,
    lng_destino real,
    motorista_id integer,
    avaliacao real,
    tempo_espera_min integer DEFAULT 5,
    observacoes text,
    cancelado_em timestamp without time zone,
    concluido_em timestamp without time zone,
    motorista_app_id integer,
    motorista_app_nome text
);


ALTER TABLE public.corridas OWNER TO postgres;

--
-- Name: corridas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.corridas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corridas_id_seq OWNER TO postgres;

--
-- Name: corridas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.corridas_id_seq OWNED BY public.corridas.id;


--
-- Name: corridas_solicitadas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.corridas_solicitadas (
    id integer NOT NULL,
    motorista_id integer NOT NULL,
    tipo_servico character varying(20) DEFAULT 'corrida'::character varying,
    categoria_nome character varying(100) DEFAULT 'GoTaxi X'::character varying,
    valor_estimado numeric(10,2) DEFAULT 0,
    origem_endereco text,
    destino_endereco text,
    distancia_motorista_km numeric(5,2) DEFAULT 0,
    tempo_motorista_min integer DEFAULT 0,
    distancia_viagem_km numeric(5,2) DEFAULT 0,
    tempo_viagem_min integer DEFAULT 0,
    cliente_nome character varying(150),
    cliente_rating numeric(3,2) DEFAULT 5.0,
    cliente_avaliacoes integer DEFAULT 0,
    status character varying(20) DEFAULT 'aguardando'::character varying,
    criado_em timestamp without time zone DEFAULT now(),
    expira_em timestamp without time zone DEFAULT (now() + '00:00:30'::interval),
    corrida_id integer,
    lat_origem double precision,
    lng_origem double precision,
    lat_destino double precision,
    lng_destino double precision,
    forma_pagamento text DEFAULT 'dinheiro'::text,
    motivo_cancelamento text
);


ALTER TABLE public.corridas_solicitadas OWNER TO postgres;

--
-- Name: corridas_solicitadas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.corridas_solicitadas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corridas_solicitadas_id_seq OWNER TO postgres;

--
-- Name: corridas_solicitadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.corridas_solicitadas_id_seq OWNED BY public.corridas_solicitadas.id;


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresas (
    id integer NOT NULL,
    nome text NOT NULL,
    codigo text NOT NULL,
    logo text,
    cor_primaria text DEFAULT '#007AFF'::text NOT NULL,
    plano text DEFAULT 'basico'::text NOT NULL,
    modulos_ativos json DEFAULT '[]'::json NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    ecommerce_status text DEFAULT 'ativo'::text NOT NULL,
    ecommerce_taxa_comissao real DEFAULT 3 NOT NULL,
    ecommerce_categoria text,
    responsavel text,
    cnpj text,
    telefone text,
    email text,
    endereco text,
    tipo_pessoa text DEFAULT 'empresa'::text NOT NULL,
    doc_rg text,
    doc_rg_status text DEFAULT 'pendente'::text NOT NULL,
    doc_cnpj text,
    doc_cnpj_status text DEFAULT 'pendente'::text NOT NULL,
    doc_selfie text,
    doc_selfie_status text DEFAULT 'pendente'::text NOT NULL,
    taxa_app real DEFAULT 3,
    chave_pix text,
    tipo_chave_pix text DEFAULT 'aleatoria'::text,
    destaque boolean DEFAULT false NOT NULL,
    afiliado_origem_codigo character varying(20),
    indicado_por character varying(20)
);


ALTER TABLE public.empresas OWNER TO postgres;

--
-- Name: empresas_corporativas_pendentes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresas_corporativas_pendentes (
    id integer NOT NULL,
    nome_fantasia character varying(200) NOT NULL,
    razao_social character varying(200),
    cnpj character varying(20) NOT NULL,
    email_empresa character varying(200) NOT NULL,
    telefone_empresa character varying(40),
    cep character varying(15),
    endereco_rua character varying(200),
    endereco_numero character varying(20),
    endereco_complemento character varying(100),
    endereco_bairro character varying(120),
    endereco_cidade character varying(120),
    endereco_estado character varying(4),
    responsavel_nome character varying(200),
    responsavel_cpf character varying(20),
    responsavel_cargo character varying(120),
    responsavel_email character varying(200),
    responsavel_telefone character varying(40),
    qtde_funcionarios integer,
    limite_credito numeric(12,2) DEFAULT 0,
    observacoes text,
    origem character varying(20) DEFAULT 'admin'::character varying,
    afiliado_id integer,
    status character varying(20) DEFAULT 'pendente'::character varying,
    empresa_id_aprovada integer,
    usuario_id_aprovado integer,
    login_pdv character varying(200),
    senha_pdv character varying(80),
    motivo_rejeicao text,
    criado_em timestamp without time zone DEFAULT now(),
    decidido_em timestamp without time zone,
    decidido_por integer
);


ALTER TABLE public.empresas_corporativas_pendentes OWNER TO postgres;

--
-- Name: empresas_corporativas_pendentes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.empresas_corporativas_pendentes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.empresas_corporativas_pendentes_id_seq OWNER TO postgres;

--
-- Name: empresas_corporativas_pendentes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.empresas_corporativas_pendentes_id_seq OWNED BY public.empresas_corporativas_pendentes.id;


--
-- Name: empresas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.empresas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.empresas_id_seq OWNER TO postgres;

--
-- Name: empresas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.empresas_id_seq OWNED BY public.empresas.id;


--
-- Name: encomendas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.encomendas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    codigo text NOT NULL,
    cliente_id integer,
    cliente_nome text,
    cliente_telefone text,
    cliente_documento text,
    origem_endereco text,
    destino_endereco text,
    destino_bairro text,
    destino_cidade text,
    tipo_pacote text DEFAULT 'pequeno'::text NOT NULL,
    peso_kg numeric,
    valor_declarado numeric DEFAULT 0,
    valor_frete numeric DEFAULT 0 NOT NULL,
    tipo_servico text DEFAULT 'normal'::text NOT NULL,
    data_envio date,
    data_previsao date,
    status text DEFAULT 'pendente'::text NOT NULL,
    forma_pagamento text DEFAULT 'dinheiro'::text NOT NULL,
    observacoes text,
    operador_nome text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.encomendas OWNER TO postgres;

--
-- Name: encomendas_clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.encomendas_clientes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    telefone text,
    documento text,
    endereco text,
    cidade text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.encomendas_clientes OWNER TO postgres;

--
-- Name: encomendas_clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.encomendas_clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.encomendas_clientes_id_seq OWNER TO postgres;

--
-- Name: encomendas_clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.encomendas_clientes_id_seq OWNED BY public.encomendas_clientes.id;


--
-- Name: encomendas_historico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.encomendas_historico (
    id integer NOT NULL,
    encomenda_id integer NOT NULL,
    status text NOT NULL,
    descricao text,
    operador_nome text,
    registrado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.encomendas_historico OWNER TO postgres;

--
-- Name: encomendas_historico_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.encomendas_historico_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.encomendas_historico_id_seq OWNER TO postgres;

--
-- Name: encomendas_historico_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.encomendas_historico_id_seq OWNED BY public.encomendas_historico.id;


--
-- Name: encomendas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.encomendas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.encomendas_id_seq OWNER TO postgres;

--
-- Name: encomendas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.encomendas_id_seq OWNED BY public.encomendas.id;


--
-- Name: entregas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entregas (
    id integer NOT NULL,
    empresa_id integer,
    remetente_nome text NOT NULL,
    remetente_telefone text,
    destinatario_nome text,
    destinatario_telefone text,
    endereco_coleta text NOT NULL,
    endereco_entrega text NOT NULL,
    descricao_pacote text,
    status text DEFAULT 'aguardando'::text NOT NULL,
    entregador_nome text,
    valor real,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    categoria character varying(50),
    distancia_km numeric(8,2),
    coleta_lat numeric(10,6),
    coleta_lng numeric(10,6),
    entrega_lat numeric(10,6),
    entrega_lng numeric(10,6),
    motorista_id integer
);


ALTER TABLE public.entregas OWNER TO postgres;

--
-- Name: entregas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entregas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entregas_id_seq OWNER TO postgres;

--
-- Name: entregas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entregas_id_seq OWNED BY public.entregas.id;


--
-- Name: entregas_solicitadas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entregas_solicitadas (
    id integer NOT NULL,
    profissional_id integer NOT NULL,
    tipo_servico character varying(20) DEFAULT 'entrega'::character varying,
    categoria_nome character varying(100) DEFAULT 'Entrega Padrão'::character varying,
    valor_estimado numeric(10,2) DEFAULT 0,
    coleta_endereco text,
    entrega_endereco text,
    distancia_profissional_km numeric(5,2) DEFAULT 0,
    tempo_profissional_min integer DEFAULT 0,
    distancia_entrega_km numeric(5,2) DEFAULT 0,
    tempo_entrega_min integer DEFAULT 0,
    cliente_nome character varying(150),
    cliente_rating numeric(3,2) DEFAULT 5.0,
    cliente_avaliacoes integer DEFAULT 0,
    descricao_item text,
    status character varying(20) DEFAULT 'aguardando'::character varying,
    criado_em timestamp without time zone DEFAULT now(),
    expira_em timestamp without time zone DEFAULT (now() + '00:00:30'::interval),
    entrega_id integer,
    pedido_pdv_id integer,
    empresa_id integer
);


ALTER TABLE public.entregas_solicitadas OWNER TO postgres;

--
-- Name: entregas_solicitadas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entregas_solicitadas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entregas_solicitadas_id_seq OWNER TO postgres;

--
-- Name: entregas_solicitadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entregas_solicitadas_id_seq OWNED BY public.entregas_solicitadas.id;


--
-- Name: extras_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.extras_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    preco real DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    obrigatorio boolean DEFAULT false NOT NULL
);


ALTER TABLE public.extras_pdv OWNER TO postgres;

--
-- Name: extras_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.extras_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.extras_pdv_id_seq OWNER TO postgres;

--
-- Name: extras_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.extras_pdv_id_seq OWNED BY public.extras_pdv.id;


--
-- Name: financeiro_lancamentos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financeiro_lancamentos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo text NOT NULL,
    valor numeric(12,2) NOT NULL,
    descricao text NOT NULL,
    categoria text DEFAULT 'outros'::text NOT NULL,
    data date DEFAULT CURRENT_DATE NOT NULL,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT financeiro_lancamentos_tipo_check CHECK ((tipo = ANY (ARRAY['receita'::text, 'despesa'::text])))
);


ALTER TABLE public.financeiro_lancamentos OWNER TO postgres;

--
-- Name: financeiro_lancamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.financeiro_lancamentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.financeiro_lancamentos_id_seq OWNER TO postgres;

--
-- Name: financeiro_lancamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.financeiro_lancamentos_id_seq OWNED BY public.financeiro_lancamentos.id;


--
-- Name: fornecedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fornecedores (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(200) NOT NULL,
    categoria character varying(50) DEFAULT 'geral'::character varying NOT NULL,
    telefone character varying(30),
    email character varying(120),
    observacoes text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.fornecedores OWNER TO postgres;

--
-- Name: fornecedores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fornecedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fornecedores_id_seq OWNER TO postgres;

--
-- Name: fornecedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fornecedores_id_seq OWNED BY public.fornecedores.id;


--
-- Name: gotatxi_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gotatxi_config (
    chave text NOT NULL,
    valor text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.gotatxi_config OWNER TO postgres;

--
-- Name: grupos_extras_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grupos_extras_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    min_selecoes integer DEFAULT 0 NOT NULL,
    max_selecoes integer DEFAULT 1 NOT NULL,
    obrigatorio boolean DEFAULT false NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.grupos_extras_pdv OWNER TO postgres;

--
-- Name: grupos_extras_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grupos_extras_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grupos_extras_pdv_id_seq OWNER TO postgres;

--
-- Name: grupos_extras_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grupos_extras_pdv_id_seq OWNED BY public.grupos_extras_pdv.id;


--
-- Name: itens_cardapio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.itens_cardapio (
    id integer NOT NULL,
    restaurante_id integer NOT NULL,
    nome text NOT NULL,
    descricao text,
    preco real NOT NULL,
    categoria text NOT NULL,
    imagem text,
    disponivel boolean DEFAULT true NOT NULL
);


ALTER TABLE public.itens_cardapio OWNER TO postgres;

--
-- Name: itens_cardapio_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.itens_cardapio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.itens_cardapio_id_seq OWNER TO postgres;

--
-- Name: itens_cardapio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.itens_cardapio_id_seq OWNED BY public.itens_cardapio.id;


--
-- Name: itens_pedido; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.itens_pedido (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    produto_nome text NOT NULL,
    quantidade integer DEFAULT 1 NOT NULL,
    preco_unitario real NOT NULL,
    total real NOT NULL,
    observacoes text
);


ALTER TABLE public.itens_pedido OWNER TO postgres;

--
-- Name: itens_pedido_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.itens_pedido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.itens_pedido_id_seq OWNER TO postgres;

--
-- Name: itens_pedido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.itens_pedido_id_seq OWNED BY public.itens_pedido.id;


--
-- Name: itens_pedido_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.itens_pedido_pdv (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    produto_nome text NOT NULL,
    quantidade integer DEFAULT 1 NOT NULL,
    preco_unitario real NOT NULL,
    total real NOT NULL,
    observacoes text
);


ALTER TABLE public.itens_pedido_pdv OWNER TO postgres;

--
-- Name: itens_pedido_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.itens_pedido_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.itens_pedido_pdv_id_seq OWNER TO postgres;

--
-- Name: itens_pedido_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.itens_pedido_pdv_id_seq OWNED BY public.itens_pedido_pdv.id;


--
-- Name: modelo_categorias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modelo_categorias (
    modelo_id integer NOT NULL,
    categoria_id integer NOT NULL
);


ALTER TABLE public.modelo_categorias OWNER TO postgres;

--
-- Name: modelos_veiculo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modelos_veiculo (
    id integer NOT NULL,
    nome text NOT NULL,
    ano_minimo integer DEFAULT 2015 NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.modelos_veiculo OWNER TO postgres;

--
-- Name: modelos_veiculo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.modelos_veiculo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.modelos_veiculo_id_seq OWNER TO postgres;

--
-- Name: modelos_veiculo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.modelos_veiculo_id_seq OWNED BY public.modelos_veiculo.id;


--
-- Name: motivos_cancelamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.motivos_cancelamento (
    id integer NOT NULL,
    texto text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.motivos_cancelamento OWNER TO postgres;

--
-- Name: motivos_cancelamento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.motivos_cancelamento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.motivos_cancelamento_id_seq OWNER TO postgres;

--
-- Name: motivos_cancelamento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.motivos_cancelamento_id_seq OWNED BY public.motivos_cancelamento.id;


--
-- Name: motorista_categorias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.motorista_categorias (
    motorista_id integer NOT NULL,
    categoria_id integer NOT NULL,
    categoria_nome text NOT NULL
);


ALTER TABLE public.motorista_categorias OWNER TO postgres;

--
-- Name: motoristas_app; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.motoristas_app (
    id integer NOT NULL,
    nome text NOT NULL,
    cpf text,
    telefone text NOT NULL,
    email text,
    senha_pin text,
    foto text,
    status text DEFAULT 'pendente'::text NOT NULL,
    cidade text,
    estado text,
    veiculo_marca text,
    veiculo_modelo text,
    veiculo_ano integer,
    veiculo_cor text,
    veiculo_placa text,
    tipo_veiculo text DEFAULT 'economico'::text,
    doc_cnh text,
    doc_cnh_status text DEFAULT 'pendente'::text,
    doc_veiculo text,
    doc_veiculo_status text DEFAULT 'pendente'::text,
    doc_selfie text,
    doc_selfie_status text DEFAULT 'pendente'::text,
    ativo boolean DEFAULT true,
    percentual_repasse real DEFAULT 20,
    saldo real DEFAULT 0,
    total_ganhos real DEFAULT 0,
    total_corridas integer DEFAULT 0,
    avaliacao_media real DEFAULT 0,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL,
    tipo_profissional text DEFAULT 'motorista'::text NOT NULL,
    doc_antecedentes text,
    doc_antecedentes_status text DEFAULT 'pendente'::text NOT NULL,
    doc_rg text,
    doc_rg_status text DEFAULT 'pendente'::text NOT NULL,
    status_repasse text DEFAULT 'ok'::text NOT NULL,
    fcm_token text,
    pix_tipo text DEFAULT 'cpf'::text,
    pix_chave text,
    pix_imagem_url text,
    online boolean DEFAULT false NOT NULL,
    lat double precision,
    lng double precision,
    ultimo_ping timestamp without time zone,
    codigo_referral character varying(20),
    indicado_por character varying(20)
);


ALTER TABLE public.motoristas_app OWNER TO postgres;

--
-- Name: motoristas_app_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.motoristas_app_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.motoristas_app_id_seq OWNER TO postgres;

--
-- Name: motoristas_app_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.motoristas_app_id_seq OWNED BY public.motoristas_app.id;


--
-- Name: motoristas_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.motoristas_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(120) NOT NULL,
    telefone character varying(30),
    veiculo character varying(80),
    placa character varying(20),
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.motoristas_pdv OWNER TO postgres;

--
-- Name: motoristas_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.motoristas_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.motoristas_pdv_id_seq OWNER TO postgres;

--
-- Name: motoristas_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.motoristas_pdv_id_seq OWNED BY public.motoristas_pdv.id;


--
-- Name: opcoes_grupo_extras_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opcoes_grupo_extras_pdv (
    id integer NOT NULL,
    grupo_id integer NOT NULL,
    nome text NOT NULL,
    preco_adicional numeric(10,2) DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.opcoes_grupo_extras_pdv OWNER TO postgres;

--
-- Name: opcoes_grupo_extras_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.opcoes_grupo_extras_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.opcoes_grupo_extras_pdv_id_seq OWNER TO postgres;

--
-- Name: opcoes_grupo_extras_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.opcoes_grupo_extras_pdv_id_seq OWNED BY public.opcoes_grupo_extras_pdv.id;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedidos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    cliente_nome text NOT NULL,
    cliente_telefone text,
    itens json DEFAULT '[]'::json NOT NULL,
    total real NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    endereco_entrega text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pedidos OWNER TO postgres;

--
-- Name: pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedidos_id_seq OWNER TO postgres;

--
-- Name: pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pedidos_id_seq OWNED BY public.pedidos.id;


--
-- Name: pedidos_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedidos_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    modulo text DEFAULT 'food'::text NOT NULL,
    tipo text DEFAULT 'delivery'::text NOT NULL,
    status text DEFAULT 'novo'::text NOT NULL,
    cliente_nome text NOT NULL,
    cliente_whatsapp text,
    cliente_endereco text,
    mesa text,
    total real DEFAULT 0 NOT NULL,
    observacoes text,
    forma_pagamento text DEFAULT 'pix'::text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL,
    confirmado_em timestamp without time zone,
    preparando_em timestamp without time zone,
    pronto_em timestamp without time zone,
    entregue_em timestamp without time zone,
    taxa_entrega real DEFAULT 0,
    distancia_km real,
    boy_id integer,
    comprovante_pix text
);


ALTER TABLE public.pedidos_pdv OWNER TO postgres;

--
-- Name: pedidos_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedidos_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedidos_pdv_id_seq OWNER TO postgres;

--
-- Name: pedidos_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pedidos_pdv_id_seq OWNED BY public.pedidos_pdv.id;


--
-- Name: pro_agendamentos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pro_agendamentos (
    id integer NOT NULL,
    tipo text DEFAULT 'corrida'::text NOT NULL,
    profissional_id integer,
    data_hora timestamp without time zone NOT NULL,
    local_embarque text NOT NULL,
    local_destino text,
    valor real DEFAULT 0,
    cliente_nome text,
    cliente_whatsapp text,
    observacoes text,
    status text DEFAULT 'pendente'::text NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pro_agendamentos OWNER TO postgres;

--
-- Name: pro_agendamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pro_agendamentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pro_agendamentos_id_seq OWNER TO postgres;

--
-- Name: pro_agendamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pro_agendamentos_id_seq OWNED BY public.pro_agendamentos.id;


--
-- Name: pro_aprovacoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pro_aprovacoes (
    id integer NOT NULL,
    corrida_id integer NOT NULL,
    aprovador_nome character varying(200),
    acao character varying(20) NOT NULL,
    observacao text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pro_aprovacoes OWNER TO postgres;

--
-- Name: pro_aprovacoes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pro_aprovacoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pro_aprovacoes_id_seq OWNER TO postgres;

--
-- Name: pro_aprovacoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pro_aprovacoes_id_seq OWNED BY public.pro_aprovacoes.id;


--
-- Name: pro_centros_custo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pro_centros_custo (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(200) NOT NULL,
    descricao text,
    limite_mensal numeric(12,2) DEFAULT 0 NOT NULL,
    gasto_mes_atual numeric(12,2) DEFAULT 0 NOT NULL,
    mes_referencia date,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pro_centros_custo OWNER TO postgres;

--
-- Name: pro_centros_custo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pro_centros_custo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pro_centros_custo_id_seq OWNER TO postgres;

--
-- Name: pro_centros_custo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pro_centros_custo_id_seq OWNED BY public.pro_centros_custo.id;


--
-- Name: pro_corridas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pro_corridas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    funcionario_id integer,
    centro_custo_id integer,
    passageiro_nome character varying(200) NOT NULL,
    passageiro_telefone character varying(30),
    origem text NOT NULL,
    origem_lat numeric(10,7),
    origem_lng numeric(10,7),
    destino text NOT NULL,
    destino_lat numeric(10,7),
    destino_lng numeric(10,7),
    motivo character varying(300),
    tipo character varying(20) DEFAULT 'imediato'::character varying NOT NULL,
    data_agendamento timestamp without time zone,
    valor_estimado numeric(10,2),
    valor_final numeric(10,2),
    distancia_km numeric(8,2),
    status character varying(30) DEFAULT 'pendente_aprovacao'::character varying NOT NULL,
    motorista_id integer,
    observacoes text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL,
    corrida_id integer,
    motoristas_chamados integer DEFAULT 0,
    chamado_em timestamp without time zone
);


ALTER TABLE public.pro_corridas OWNER TO postgres;

--
-- Name: pro_corridas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pro_corridas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pro_corridas_id_seq OWNER TO postgres;

--
-- Name: pro_corridas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pro_corridas_id_seq OWNED BY public.pro_corridas.id;


--
-- Name: pro_faturas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pro_faturas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    mes_referencia date NOT NULL,
    total_corridas integer DEFAULT 0 NOT NULL,
    valor_total numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'aberta'::character varying NOT NULL,
    pdf_path character varying(500),
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    fechada_em timestamp without time zone,
    paga_em timestamp without time zone
);


ALTER TABLE public.pro_faturas OWNER TO postgres;

--
-- Name: pro_faturas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pro_faturas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pro_faturas_id_seq OWNER TO postgres;

--
-- Name: pro_faturas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pro_faturas_id_seq OWNED BY public.pro_faturas.id;


--
-- Name: pro_funcionarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pro_funcionarios (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    centro_custo_id integer,
    nome character varying(200) NOT NULL,
    email character varying(200),
    cargo character varying(100),
    telefone character varying(30),
    pode_solicitar boolean DEFAULT true NOT NULL,
    precisa_aprovacao boolean DEFAULT false NOT NULL,
    limite_corrida numeric(10,2),
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pro_funcionarios OWNER TO postgres;

--
-- Name: pro_funcionarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pro_funcionarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pro_funcionarios_id_seq OWNER TO postgres;

--
-- Name: pro_funcionarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pro_funcionarios_id_seq OWNED BY public.pro_funcionarios.id;


--
-- Name: produto_extras_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produto_extras_pdv (
    produto_id integer NOT NULL,
    extra_id integer NOT NULL
);


ALTER TABLE public.produto_extras_pdv OWNER TO postgres;

--
-- Name: produto_grupos_extras_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produto_grupos_extras_pdv (
    produto_id integer NOT NULL,
    grupo_id integer NOT NULL,
    ordem integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.produto_grupos_extras_pdv OWNER TO postgres;

--
-- Name: produtos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produtos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    descricao text,
    preco real NOT NULL,
    preco_promocional real,
    estoque integer DEFAULT 0 NOT NULL,
    categoria text NOT NULL,
    imagem text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.produtos OWNER TO postgres;

--
-- Name: produtos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.produtos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.produtos_id_seq OWNER TO postgres;

--
-- Name: produtos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.produtos_id_seq OWNED BY public.produtos.id;


--
-- Name: produtos_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produtos_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    categoria_id integer,
    nome text NOT NULL,
    descricao text,
    preco real DEFAULT 0 NOT NULL,
    imagem text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    tamanhos jsonb
);


ALTER TABLE public.produtos_pdv OWNER TO postgres;

--
-- Name: produtos_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.produtos_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.produtos_pdv_id_seq OWNER TO postgres;

--
-- Name: produtos_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.produtos_pdv_id_seq OWNED BY public.produtos_pdv.id;


--
-- Name: promocoes_pdv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promocoes_pdv (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome character varying(120) NOT NULL,
    descricao text,
    tipo character varying(20) DEFAULT 'percentual'::character varying NOT NULL,
    valor numeric(10,2) DEFAULT 0 NOT NULL,
    codigo_cupom character varying(40),
    min_pedido numeric(10,2) DEFAULT 0,
    ativo boolean DEFAULT true NOT NULL,
    validade date,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    produto_id integer,
    preco_promocional numeric(10,2),
    quantidade_disponivel integer
);


ALTER TABLE public.promocoes_pdv OWNER TO postgres;

--
-- Name: promocoes_pdv_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.promocoes_pdv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promocoes_pdv_id_seq OWNER TO postgres;

--
-- Name: promocoes_pdv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.promocoes_pdv_id_seq OWNED BY public.promocoes_pdv.id;


--
-- Name: push_historico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_historico (
    id integer NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    modulo text DEFAULT 'todos'::text,
    total_tokens integer DEFAULT 0,
    total_enviado integer DEFAULT 0,
    criado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.push_historico OWNER TO postgres;

--
-- Name: push_historico_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.push_historico_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_historico_id_seq OWNER TO postgres;

--
-- Name: push_historico_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.push_historico_id_seq OWNED BY public.push_historico.id;


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_tokens (
    id integer NOT NULL,
    usuario_id integer,
    token text NOT NULL,
    plataforma text DEFAULT 'expo'::text,
    modulos text[] DEFAULT '{}'::text[],
    ativo boolean DEFAULT true,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.push_tokens OWNER TO postgres;

--
-- Name: push_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.push_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_tokens_id_seq OWNER TO postgres;

--
-- Name: push_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.push_tokens_id_seq OWNED BY public.push_tokens.id;


--
-- Name: repasses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repasses (
    id integer NOT NULL,
    empresa_id integer,
    semana_inicio date NOT NULL,
    semana_fim date NOT NULL,
    receita_total numeric(10,2) DEFAULT 0 NOT NULL,
    taxa_percentual numeric(5,2) DEFAULT 3.00 NOT NULL,
    valor_repasse numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(50) DEFAULT 'pendente'::character varying NOT NULL,
    pago_em timestamp without time zone,
    ativado_por integer,
    criado_em timestamp without time zone DEFAULT now(),
    comprovante_path character varying(500),
    comprovante_enviado_em timestamp without time zone,
    comprovante_observacao text
);


ALTER TABLE public.repasses OWNER TO postgres;

--
-- Name: repasses_corporativos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repasses_corporativos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    semana_inicio date NOT NULL,
    semana_fim date NOT NULL,
    total_corridas integer DEFAULT 0 NOT NULL,
    valor_total numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    vencimento date,
    pago_em timestamp without time zone,
    comprovante_url character varying(500),
    observacoes text,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.repasses_corporativos OWNER TO postgres;

--
-- Name: repasses_corporativos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repasses_corporativos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repasses_corporativos_id_seq OWNER TO postgres;

--
-- Name: repasses_corporativos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repasses_corporativos_id_seq OWNED BY public.repasses_corporativos.id;


--
-- Name: repasses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repasses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repasses_id_seq OWNER TO postgres;

--
-- Name: repasses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repasses_id_seq OWNED BY public.repasses.id;


--
-- Name: repasses_pro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repasses_pro (
    id integer NOT NULL,
    profissional_id integer NOT NULL,
    tipo_profissional text NOT NULL,
    semana_inicio date NOT NULL,
    semana_fim date NOT NULL,
    total_ganhos real DEFAULT 0 NOT NULL,
    percentual real DEFAULT 3 NOT NULL,
    valor_repasse real DEFAULT 0 NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    comprovante text,
    pago_em timestamp without time zone,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.repasses_pro OWNER TO postgres;

--
-- Name: repasses_pro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repasses_pro_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repasses_pro_id_seq OWNER TO postgres;

--
-- Name: repasses_pro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repasses_pro_id_seq OWNED BY public.repasses_pro.id;


--
-- Name: reservas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reservas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    rota_id integer NOT NULL,
    passageiro_nome text NOT NULL,
    passageiro_documento text,
    passageiro_telefone text,
    assento text,
    status text DEFAULT 'pendente'::text NOT NULL,
    total real NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reservas OWNER TO postgres;

--
-- Name: reservas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reservas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reservas_id_seq OWNER TO postgres;

--
-- Name: reservas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reservas_id_seq OWNED BY public.reservas.id;


--
-- Name: restaurantes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.restaurantes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    descricao text,
    categoria text NOT NULL,
    tempo_entrega_min integer DEFAULT 30 NOT NULL,
    avaliacao_media real,
    taxa_entrega real DEFAULT 0 NOT NULL,
    aberto boolean DEFAULT true NOT NULL,
    imagem text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    lat_loja numeric(10,8),
    lng_loja numeric(11,8),
    raio_visibilidade_km numeric(6,2) DEFAULT 50,
    status text DEFAULT 'ativo'::text NOT NULL,
    plano text DEFAULT 'free'::text NOT NULL,
    taxa_comissao real DEFAULT 10 NOT NULL,
    telefone text,
    email text,
    responsavel text,
    cnpj text,
    endereco text,
    tipo_pessoa text DEFAULT 'empresa'::text NOT NULL,
    doc_rg text,
    doc_rg_status text DEFAULT 'pendente'::text NOT NULL,
    doc_cnpj text,
    doc_cnpj_status text DEFAULT 'pendente'::text NOT NULL,
    doc_selfie text,
    doc_selfie_status text DEFAULT 'pendente'::text NOT NULL,
    subcategoria_id integer
);


ALTER TABLE public.restaurantes OWNER TO postgres;

--
-- Name: restaurantes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.restaurantes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.restaurantes_id_seq OWNER TO postgres;

--
-- Name: restaurantes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.restaurantes_id_seq OWNED BY public.restaurantes.id;


--
-- Name: rotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rotas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    origem text NOT NULL,
    destino text NOT NULL,
    horario_partida text NOT NULL,
    horario_chegada text NOT NULL,
    preco real NOT NULL,
    assentos_disponiveis integer NOT NULL,
    total_assentos integer NOT NULL,
    empresa_nome text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'ativo'::text NOT NULL,
    plano text DEFAULT 'free'::text NOT NULL,
    taxa_comissao real DEFAULT 8 NOT NULL,
    tipo text DEFAULT 'rodoviaria'::text NOT NULL,
    telefone text,
    email text,
    responsavel text,
    cnpj text,
    cidade text,
    estado text,
    doc_cnpj text,
    doc_cnpj_status text DEFAULT 'pendente'::text NOT NULL,
    doc_cnh text,
    doc_cnh_status text DEFAULT 'pendente'::text NOT NULL,
    doc_crlv text,
    doc_crlv_status text DEFAULT 'pendente'::text NOT NULL,
    doc_selfie text,
    doc_selfie_status text DEFAULT 'pendente'::text NOT NULL
);


ALTER TABLE public.rotas OWNER TO postgres;

--
-- Name: rotas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rotas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rotas_id_seq OWNER TO postgres;

--
-- Name: rotas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rotas_id_seq OWNED BY public.rotas.id;


--
-- Name: servicos_catalogo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servicos_catalogo (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    prestador_id integer,
    categoria_id integer,
    nome text NOT NULL,
    descricao text,
    duracao_minutos integer DEFAULT 60 NOT NULL,
    preco numeric(10,2) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.servicos_catalogo OWNER TO postgres;

--
-- Name: servicos_catalogo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servicos_catalogo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servicos_catalogo_id_seq OWNER TO postgres;

--
-- Name: servicos_catalogo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servicos_catalogo_id_seq OWNED BY public.servicos_catalogo.id;


--
-- Name: servicos_pacotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servicos_pacotes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    descricao text,
    preco_total numeric(10,2) NOT NULL,
    sessoes integer DEFAULT 1 NOT NULL,
    validade_dias integer,
    catalogo_ids text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.servicos_pacotes OWNER TO postgres;

--
-- Name: servicos_pacotes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servicos_pacotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servicos_pacotes_id_seq OWNER TO postgres;

--
-- Name: servicos_pacotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servicos_pacotes_id_seq OWNED BY public.servicos_pacotes.id;


--
-- Name: servicos_prestadores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servicos_prestadores (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    especialidade text,
    telefone text,
    email text,
    bio text,
    avatar_url text,
    ativo boolean DEFAULT true NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    motivo_bloqueio text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.servicos_prestadores OWNER TO postgres;

--
-- Name: servicos_prestadores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servicos_prestadores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servicos_prestadores_id_seq OWNER TO postgres;

--
-- Name: servicos_prestadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servicos_prestadores_id_seq OWNED BY public.servicos_prestadores.id;


--
-- Name: servicos_promocoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servicos_promocoes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    descricao text,
    tipo text DEFAULT 'percentual'::text NOT NULL,
    valor numeric(10,2) NOT NULL,
    valido_de date,
    valido_ate date,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.servicos_promocoes OWNER TO postgres;

--
-- Name: servicos_promocoes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servicos_promocoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servicos_promocoes_id_seq OWNER TO postgres;

--
-- Name: servicos_promocoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servicos_promocoes_id_seq OWNED BY public.servicos_promocoes.id;


--
-- Name: subcategorias_alimentacao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subcategorias_alimentacao (
    id integer NOT NULL,
    nome text NOT NULL,
    slug text NOT NULL,
    emoji text,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.subcategorias_alimentacao OWNER TO postgres;

--
-- Name: subcategorias_alimentacao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subcategorias_alimentacao_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subcategorias_alimentacao_id_seq OWNER TO postgres;

--
-- Name: subcategorias_alimentacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subcategorias_alimentacao_id_seq OWNED BY public.subcategorias_alimentacao.id;


--
-- Name: suporte_mensagens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suporte_mensagens (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    remetente text NOT NULL,
    mensagem text NOT NULL,
    lida boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suporte_mensagens_remetente_check CHECK ((remetente = ANY (ARRAY['loja'::text, 'admin'::text, 'ia'::text])))
);


ALTER TABLE public.suporte_mensagens OWNER TO postgres;

--
-- Name: suporte_mensagens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.suporte_mensagens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suporte_mensagens_id_seq OWNER TO postgres;

--
-- Name: suporte_mensagens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.suporte_mensagens_id_seq OWNED BY public.suporte_mensagens.id;


--
-- Name: suporte_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suporte_tickets (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    empresa_nome text DEFAULT ''::text NOT NULL,
    titulo text NOT NULL,
    status text DEFAULT 'aberto'::text NOT NULL,
    prioridade text DEFAULT 'normal'::text NOT NULL,
    categoria text DEFAULT 'geral'::text NOT NULL,
    nao_lidas_admin integer DEFAULT 0 NOT NULL,
    nao_lidas_loja integer DEFAULT 0 NOT NULL,
    ultima_mensagem text,
    ultima_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suporte_tickets_prioridade_check CHECK ((prioridade = ANY (ARRAY['baixa'::text, 'normal'::text, 'alta'::text, 'urgente'::text]))),
    CONSTRAINT suporte_tickets_status_check CHECK ((status = ANY (ARRAY['aberto'::text, 'em_andamento'::text, 'resolvido'::text, 'fechado'::text])))
);


ALTER TABLE public.suporte_tickets OWNER TO postgres;

--
-- Name: suporte_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.suporte_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suporte_tickets_id_seq OWNER TO postgres;

--
-- Name: suporte_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.suporte_tickets_id_seq OWNED BY public.suporte_tickets.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha_hash text NOT NULL,
    telefone text,
    avatar text,
    papel text DEFAULT 'cliente'::text NOT NULL,
    empresa_id integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    endereco text,
    forma_pagamento text,
    afiliado_origem_codigo character varying(20),
    codigo_referral character varying(20),
    indicado_por character varying(20),
    credito_aplicativo numeric(10,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: viagens_clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viagens_clientes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nome text NOT NULL,
    cpf text,
    telefone text,
    email text,
    data_nascimento date,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.viagens_clientes OWNER TO postgres;

--
-- Name: viagens_clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.viagens_clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.viagens_clientes_id_seq OWNER TO postgres;

--
-- Name: viagens_clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.viagens_clientes_id_seq OWNED BY public.viagens_clientes.id;


--
-- Name: viagens_horarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viagens_horarios (
    id integer NOT NULL,
    rota_id integer NOT NULL,
    empresa_id integer NOT NULL,
    data_partida date NOT NULL,
    hora_partida time without time zone NOT NULL,
    hora_chegada time without time zone,
    vagas_total integer DEFAULT 40 NOT NULL,
    vagas_ocupadas integer DEFAULT 0 NOT NULL,
    preco numeric(10,2) NOT NULL,
    veiculo text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.viagens_horarios OWNER TO postgres;

--
-- Name: viagens_horarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.viagens_horarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.viagens_horarios_id_seq OWNER TO postgres;

--
-- Name: viagens_horarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.viagens_horarios_id_seq OWNED BY public.viagens_horarios.id;


--
-- Name: viagens_passagens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viagens_passagens (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    cliente_id integer,
    horario_id integer,
    assento text,
    valor numeric(10,2) NOT NULL,
    forma_pagamento text DEFAULT 'pix'::text NOT NULL,
    status text DEFAULT 'confirmado'::text NOT NULL,
    observacoes text,
    operador_nome text,
    vendido_em timestamp without time zone DEFAULT now() NOT NULL,
    usuario_id integer
);


ALTER TABLE public.viagens_passagens OWNER TO postgres;

--
-- Name: viagens_passagens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.viagens_passagens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.viagens_passagens_id_seq OWNER TO postgres;

--
-- Name: viagens_passagens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.viagens_passagens_id_seq OWNED BY public.viagens_passagens.id;


--
-- Name: viagens_rotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viagens_rotas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    origem text NOT NULL,
    destino text NOT NULL,
    duracao_minutos integer,
    tipo text DEFAULT 'onibus'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.viagens_rotas OWNER TO postgres;

--
-- Name: viagens_rotas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.viagens_rotas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.viagens_rotas_id_seq OWNER TO postgres;

--
-- Name: viagens_rotas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.viagens_rotas_id_seq OWNED BY public.viagens_rotas.id;


--
-- Name: afiliado_comissoes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_comissoes ALTER COLUMN id SET DEFAULT nextval('public.afiliado_comissoes_id_seq'::regclass);


--
-- Name: afiliado_indicacoes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_indicacoes ALTER COLUMN id SET DEFAULT nextval('public.afiliado_indicacoes_id_seq'::regclass);


--
-- Name: afiliado_resgates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_resgates ALTER COLUMN id SET DEFAULT nextval('public.afiliado_resgates_id_seq'::regclass);


--
-- Name: afiliados id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliados ALTER COLUMN id SET DEFAULT nextval('public.afiliados_id_seq'::regclass);


--
-- Name: afiliados_config id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliados_config ALTER COLUMN id SET DEFAULT nextval('public.afiliados_config_id_seq'::regclass);


--
-- Name: agendamentos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos ALTER COLUMN id SET DEFAULT nextval('public.agendamentos_id_seq'::regclass);


--
-- Name: carona_paradas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carona_paradas ALTER COLUMN id SET DEFAULT nextval('public.carona_paradas_id_seq'::regclass);


--
-- Name: carona_reservas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carona_reservas ALTER COLUMN id SET DEFAULT nextval('public.carona_reservas_id_seq'::regclass);


--
-- Name: carona_veiculos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carona_veiculos ALTER COLUMN id SET DEFAULT nextval('public.carona_veiculos_id_seq'::regclass);


--
-- Name: caronas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caronas ALTER COLUMN id SET DEFAULT nextval('public.caronas_id_seq'::regclass);


--
-- Name: categorias_corrida id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_corrida ALTER COLUMN id SET DEFAULT nextval('public.categorias_corrida_id_seq'::regclass);


--
-- Name: categorias_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_pdv ALTER COLUMN id SET DEFAULT nextval('public.categorias_pdv_id_seq'::regclass);


--
-- Name: categorias_servicos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_servicos ALTER COLUMN id SET DEFAULT nextval('public.categorias_servicos_id_seq'::regclass);


--
-- Name: chat_conversas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_conversas ALTER COLUMN id SET DEFAULT nextval('public.chat_conversas_id_seq'::regclass);


--
-- Name: chat_mensagens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensagens ALTER COLUMN id SET DEFAULT nextval('public.chat_mensagens_id_seq'::regclass);


--
-- Name: compras id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras ALTER COLUMN id SET DEFAULT nextval('public.compras_id_seq'::regclass);


--
-- Name: compras_itens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras_itens ALTER COLUMN id SET DEFAULT nextval('public.compras_itens_id_seq'::regclass);


--
-- Name: config_ecommerce_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_ecommerce_pdv ALTER COLUMN id SET DEFAULT nextval('public.config_ecommerce_pdv_id_seq'::regclass);


--
-- Name: config_entrega_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_entrega_pdv ALTER COLUMN id SET DEFAULT nextval('public.config_entrega_pdv_id_seq'::regclass);


--
-- Name: configuracoes_plataforma id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracoes_plataforma ALTER COLUMN id SET DEFAULT nextval('public.configuracoes_plataforma_id_seq'::regclass);


--
-- Name: corrida_mensagens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corrida_mensagens ALTER COLUMN id SET DEFAULT nextval('public.corrida_mensagens_id_seq'::regclass);


--
-- Name: corridas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corridas ALTER COLUMN id SET DEFAULT nextval('public.corridas_id_seq'::regclass);


--
-- Name: corridas_solicitadas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corridas_solicitadas ALTER COLUMN id SET DEFAULT nextval('public.corridas_solicitadas_id_seq'::regclass);


--
-- Name: empresas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas ALTER COLUMN id SET DEFAULT nextval('public.empresas_id_seq'::regclass);


--
-- Name: empresas_corporativas_pendentes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas_corporativas_pendentes ALTER COLUMN id SET DEFAULT nextval('public.empresas_corporativas_pendentes_id_seq'::regclass);


--
-- Name: encomendas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encomendas ALTER COLUMN id SET DEFAULT nextval('public.encomendas_id_seq'::regclass);


--
-- Name: encomendas_clientes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encomendas_clientes ALTER COLUMN id SET DEFAULT nextval('public.encomendas_clientes_id_seq'::regclass);


--
-- Name: encomendas_historico id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encomendas_historico ALTER COLUMN id SET DEFAULT nextval('public.encomendas_historico_id_seq'::regclass);


--
-- Name: entregas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entregas ALTER COLUMN id SET DEFAULT nextval('public.entregas_id_seq'::regclass);


--
-- Name: entregas_solicitadas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entregas_solicitadas ALTER COLUMN id SET DEFAULT nextval('public.entregas_solicitadas_id_seq'::regclass);


--
-- Name: extras_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extras_pdv ALTER COLUMN id SET DEFAULT nextval('public.extras_pdv_id_seq'::regclass);


--
-- Name: financeiro_lancamentos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financeiro_lancamentos ALTER COLUMN id SET DEFAULT nextval('public.financeiro_lancamentos_id_seq'::regclass);


--
-- Name: fornecedores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fornecedores ALTER COLUMN id SET DEFAULT nextval('public.fornecedores_id_seq'::regclass);


--
-- Name: grupos_extras_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos_extras_pdv ALTER COLUMN id SET DEFAULT nextval('public.grupos_extras_pdv_id_seq'::regclass);


--
-- Name: itens_cardapio id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_cardapio ALTER COLUMN id SET DEFAULT nextval('public.itens_cardapio_id_seq'::regclass);


--
-- Name: itens_pedido id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_pedido ALTER COLUMN id SET DEFAULT nextval('public.itens_pedido_id_seq'::regclass);


--
-- Name: itens_pedido_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_pedido_pdv ALTER COLUMN id SET DEFAULT nextval('public.itens_pedido_pdv_id_seq'::regclass);


--
-- Name: modelos_veiculo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modelos_veiculo ALTER COLUMN id SET DEFAULT nextval('public.modelos_veiculo_id_seq'::regclass);


--
-- Name: motivos_cancelamento id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.motivos_cancelamento ALTER COLUMN id SET DEFAULT nextval('public.motivos_cancelamento_id_seq'::regclass);


--
-- Name: motoristas_app id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.motoristas_app ALTER COLUMN id SET DEFAULT nextval('public.motoristas_app_id_seq'::regclass);


--
-- Name: motoristas_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.motoristas_pdv ALTER COLUMN id SET DEFAULT nextval('public.motoristas_pdv_id_seq'::regclass);


--
-- Name: opcoes_grupo_extras_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opcoes_grupo_extras_pdv ALTER COLUMN id SET DEFAULT nextval('public.opcoes_grupo_extras_pdv_id_seq'::regclass);


--
-- Name: pedidos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN id SET DEFAULT nextval('public.pedidos_id_seq'::regclass);


--
-- Name: pedidos_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos_pdv ALTER COLUMN id SET DEFAULT nextval('public.pedidos_pdv_id_seq'::regclass);


--
-- Name: pro_agendamentos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_agendamentos ALTER COLUMN id SET DEFAULT nextval('public.pro_agendamentos_id_seq'::regclass);


--
-- Name: pro_aprovacoes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_aprovacoes ALTER COLUMN id SET DEFAULT nextval('public.pro_aprovacoes_id_seq'::regclass);


--
-- Name: pro_centros_custo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_centros_custo ALTER COLUMN id SET DEFAULT nextval('public.pro_centros_custo_id_seq'::regclass);


--
-- Name: pro_corridas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_corridas ALTER COLUMN id SET DEFAULT nextval('public.pro_corridas_id_seq'::regclass);


--
-- Name: pro_faturas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_faturas ALTER COLUMN id SET DEFAULT nextval('public.pro_faturas_id_seq'::regclass);


--
-- Name: pro_funcionarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_funcionarios ALTER COLUMN id SET DEFAULT nextval('public.pro_funcionarios_id_seq'::regclass);


--
-- Name: produtos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos ALTER COLUMN id SET DEFAULT nextval('public.produtos_id_seq'::regclass);


--
-- Name: produtos_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos_pdv ALTER COLUMN id SET DEFAULT nextval('public.produtos_pdv_id_seq'::regclass);


--
-- Name: promocoes_pdv id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promocoes_pdv ALTER COLUMN id SET DEFAULT nextval('public.promocoes_pdv_id_seq'::regclass);


--
-- Name: push_historico id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_historico ALTER COLUMN id SET DEFAULT nextval('public.push_historico_id_seq'::regclass);


--
-- Name: push_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_tokens ALTER COLUMN id SET DEFAULT nextval('public.push_tokens_id_seq'::regclass);


--
-- Name: repasses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses ALTER COLUMN id SET DEFAULT nextval('public.repasses_id_seq'::regclass);


--
-- Name: repasses_corporativos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses_corporativos ALTER COLUMN id SET DEFAULT nextval('public.repasses_corporativos_id_seq'::regclass);


--
-- Name: repasses_pro id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses_pro ALTER COLUMN id SET DEFAULT nextval('public.repasses_pro_id_seq'::regclass);


--
-- Name: reservas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservas ALTER COLUMN id SET DEFAULT nextval('public.reservas_id_seq'::regclass);


--
-- Name: restaurantes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurantes ALTER COLUMN id SET DEFAULT nextval('public.restaurantes_id_seq'::regclass);


--
-- Name: rotas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotas ALTER COLUMN id SET DEFAULT nextval('public.rotas_id_seq'::regclass);


--
-- Name: servicos_catalogo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_catalogo ALTER COLUMN id SET DEFAULT nextval('public.servicos_catalogo_id_seq'::regclass);


--
-- Name: servicos_pacotes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_pacotes ALTER COLUMN id SET DEFAULT nextval('public.servicos_pacotes_id_seq'::regclass);


--
-- Name: servicos_prestadores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_prestadores ALTER COLUMN id SET DEFAULT nextval('public.servicos_prestadores_id_seq'::regclass);


--
-- Name: servicos_promocoes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_promocoes ALTER COLUMN id SET DEFAULT nextval('public.servicos_promocoes_id_seq'::regclass);


--
-- Name: subcategorias_alimentacao id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategorias_alimentacao ALTER COLUMN id SET DEFAULT nextval('public.subcategorias_alimentacao_id_seq'::regclass);


--
-- Name: suporte_mensagens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suporte_mensagens ALTER COLUMN id SET DEFAULT nextval('public.suporte_mensagens_id_seq'::regclass);


--
-- Name: suporte_tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suporte_tickets ALTER COLUMN id SET DEFAULT nextval('public.suporte_tickets_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: viagens_clientes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_clientes ALTER COLUMN id SET DEFAULT nextval('public.viagens_clientes_id_seq'::regclass);


--
-- Name: viagens_horarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_horarios ALTER COLUMN id SET DEFAULT nextval('public.viagens_horarios_id_seq'::regclass);


--
-- Name: viagens_passagens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_passagens ALTER COLUMN id SET DEFAULT nextval('public.viagens_passagens_id_seq'::regclass);


--
-- Name: viagens_rotas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_rotas ALTER COLUMN id SET DEFAULT nextval('public.viagens_rotas_id_seq'::regclass);


--
-- Data for Name: afiliado_comissoes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.afiliado_comissoes (id, afiliado_id, indicado_id, tipo_evento, valor_transacao, percentual, valor_comissao, status, referencia_id, descricao, criado_em) FROM stdin;
\.


--
-- Data for Name: afiliado_indicacoes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.afiliado_indicacoes (id, afiliado_id, usuario_indicado_id, nome_indicado, status, bonus_valor, criado_em, tipo_indicado, tipo_dispositivo, email_indicado) FROM stdin;
\.


--
-- Data for Name: afiliado_resgates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.afiliado_resgates (id, afiliado_id, valor, chave_pix, status, observacao, criado_em, processado_em, processado_por) FROM stdin;
\.


--
-- Data for Name: afiliados; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.afiliados (id, usuario_id, codigo, saldo, total_indicados, total_ganhos, status, criado_em, percentual_comissao, chave_pix, tipo_pessoa, banco_nome, total_comissoes) FROM stdin;
\.


--
-- Data for Name: afiliados_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.afiliados_config (id, percentual_comissao, valor_minimo_saque, ativo, atualizado_em, atualizado_por) FROM stdin;
1	10.00	50.00	t	2026-04-12 12:08:21.011837	\N
\.


--
-- Data for Name: agendamentos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.agendamentos (id, empresa_id, categoria_id, cliente_nome, cliente_telefone, servico_nome, prestador_nome, data_hora, status, valor, observacoes, criado_em, prestador_id, catalogo_id, valor_pago, pago_em, metodo_pagamento, comissao_gotaxi) FROM stdin;
1	5	\N	Sandra Lima	11988881234	Corte de Cabelo	\N	2026-04-09 10:00:00	concluido	80	\N	2026-04-08 23:39:19.477441	1	\N	80.00	2026-04-08 23:39:29.62	pix	2.40
\.


--
-- Data for Name: carona_paradas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carona_paradas (id, carona_id, cidade, hora_prevista, ordem, aceita_embarque, aceita_desembarque) FROM stdin;
\.


--
-- Data for Name: carona_reservas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carona_reservas (id, carona_id, passageiro_nome, passageiro_telefone, passageiro_cpf, parada_embarque, parada_desembarque, valor, forma_pagamento, status, observacoes, created_at) FROM stdin;
\.


--
-- Data for Name: carona_veiculos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carona_veiculos (id, empresa_id, modelo, placa, ano, cor, vagas, combustivel, consumo_km_l, observacoes, ativo, created_at) FROM stdin;
\.


--
-- Data for Name: caronas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.caronas (id, empresa_id, veiculo_id, origem, destino, distancia_km, data_viagem, hora_partida, vagas_total, vagas_ocupadas, valor_por_vaga, tipo, status, observacoes, created_at) FROM stdin;
\.


--
-- Data for Name: categorias_corrida; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorias_corrida (id, nome, taxa_minima, taxa_por_km, dist_chamada_km, ativo, criado_em) FROM stdin;
1	GoTaxi X	10	2.5	5	t	2026-03-20 22:28:47.083156
2	GoTaxi Plus	10	3.5	5	t	2026-03-20 22:28:59.894129
3	GoTaxi Black	15	5	5	t	2026-03-20 22:28:59.939184
\.


--
-- Data for Name: categorias_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorias_pdv (id, empresa_id, nome, ordem, criado_em) FROM stdin;
11	5	Pizzas Salgadas	1	2026-04-09 11:14:07.104111
12	5	Pizzas Doces	2	2026-04-09 11:14:07.104111
13	5	Massas	3	2026-04-09 11:14:07.104111
14	5	Bebidas	4	2026-04-09 11:14:07.104111
\.


--
-- Data for Name: categorias_servicos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorias_servicos (id, empresa_id, nome, icone, cor) FROM stdin;
4	5	Beleza	scissors	#EC4899
5	5	Reparos	tool	#F59E0B
6	5	Bem-estar	heart	#10B981
7	16	Manicure	scissors	#EC4899
8	16	Pedicure	star	#F97316
\.


--
-- Data for Name: chat_conversas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_conversas (id, empresa_id, cliente_nome, cliente_token, ultima_mensagem, ultima_at, nao_lidas_loja, created_at) FROM stdin;
1	5	João Teste	tok123abc	Olá, como posso ajudar?	2026-05-04 18:49:56.179608+00	0	2026-05-04 18:15:58.95248+00
\.


--
-- Data for Name: chat_mensagens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_mensagens (id, conversa_id, remetente, mensagem, lida, created_at) FROM stdin;
2	1	loja	Olá, como posso ajudar?	f	2026-05-04 18:49:55.984787+00
1	1	cliente	Olá! Meu pedido chegou errado.	t	2026-05-04 18:16:21.606618+00
\.


--
-- Data for Name: compras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compras (id, empresa_id, fornecedor_id, fornecedor_nome, data_compra, total, status, observacoes, lancamento_id, created_at) FROM stdin;
1	5	1	Distribuidora São Paulo	2026-05-04	147.50	pago	NF 1234	2	2026-05-04 19:32:02.75636+00
\.


--
-- Data for Name: compras_itens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compras_itens (id, compra_id, produto, quantidade, unidade, valor_unitario, subtotal) FROM stdin;
1	1	Mussarela	2.000	kg	45.00	90.00
2	1	Farinha de trigo	5.000	kg	6.50	32.50
3	1	Calabresa	1.000	kg	25.00	25.00
\.


--
-- Data for Name: config_ecommerce_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.config_ecommerce_pdv (id, empresa_id, venda_local_ativo, raio_km, venda_nacional_ativo, jadlog_contrato, jadlog_senha, criado_em) FROM stdin;
1	5	t	20	t	\N	\N	2026-04-08 21:26:05.926069
\.


--
-- Data for Name: config_entrega_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.config_entrega_pdv (id, empresa_id, tipo, taxa_fixa, taxa_por_km, km_minimo, raio_max_km, taxa_minima, endereco_restaurante, lat_restaurante, lng_restaurante, ativo, criado_em, atualizado_em, timeline_ativo, raio_motoboy_km) FROM stdin;
5	5	fixa	5.00	2.00	0.00	15.00	5.00	\N	\N	\N	t	2026-04-08 21:03:31.440074	2026-04-08 21:03:31.551093	t	5.00
\.


--
-- Data for Name: config_pagamento_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.config_pagamento_pdv (empresa_id, metodos, atualizado_em) FROM stdin;
5	{pix,dinheiro,credito,debito}	2026-04-08 20:41:08.896751
\.


--
-- Data for Name: configuracoes_plataforma; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuracoes_plataforma (id, taxa_repasse, chave_pix, tipo_chave_pix, nome_beneficiario, dia_vencimento, hora_vencimento, atualizado_em, whatsapp_suporte, raio_busca_motorista_km) FROM stdin;
1	3.00	2641021600119	cnpj	Go Services Company	1	18:00	2026-03-23 14:57:29.583634	5511942377344	10.00
\.


--
-- Data for Name: configuracoes_sistema; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuracoes_sistema (chave, valor, atualizado_em) FROM stdin;
politica_privacidade		2026-04-12 13:32:59.829344
termos_de_uso		2026-04-12 13:32:59.829344
afiliados_descricao	O programa de afiliados GoTaxi Brasil Plus permite que você ganhe comissões indicando novos usuários para a plataforma.	2026-04-12 13:32:59.829344
afiliados_como_funciona	Compartilhe seu link único, seus indicados se cadastram e usam o app, e você ganha 10% do lucro GoTaxi gerado por eles.	2026-04-12 13:32:59.829344
afiliados_prazo_pagamento_dias	3	2026-04-12 13:32:59.829344
afiliados_requisitos	Ter conta ativa no GoTaxi Brasil Plus. Não há limite de indicações.	2026-04-12 13:32:59.829344
entrega_padrao_taxa_minima	5.00	2026-04-26 19:01:31.903657
entrega_padrao_distancia_km	3	2026-04-26 19:01:32.199525
entrega_padrao_taxa_km	2.00	2026-04-26 19:01:32.203277
\.


--
-- Data for Name: corrida_mensagens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.corrida_mensagens (id, corrida_id, remetente, texto, criado_em) FROM stdin;
1	1	passageiro	Oi motorista, já estou esperando!	2026-03-23 17:04:47.199006
2	1	passageiro	Oi motorista!	2026-03-23 17:04:51.541709
3	13	passageiro	Oi	2026-03-23 17:11:24.670044
4	13	passageiro	Tudo bem	2026-03-23 17:11:53.042219
5	23	motorista	Ok	2026-03-23 17:12:06.20296
6	23	motorista	Oi	2026-03-23 17:12:20.461951
7	23	motorista	Oin	2026-03-23 17:12:38.368438
8	14	passageiro	Oi	2026-03-23 17:21:17.495152
9	14	motorista	Oi	2026-03-23 17:21:28.849075
\.


--
-- Data for Name: corridas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.corridas (id, empresa_id, passageiro_nome, passageiro_telefone, origem_endereco, destino_endereco, status, valor, distancia_km, motorista_nome, criado_em, tipo_veiculo, forma_pagamento, lat_origem, lng_origem, lat_destino, lng_destino, motorista_id, avaliacao, tempo_espera_min, observacoes, cancelado_em, concluido_em, motorista_app_id, motorista_app_nome) FROM stdin;
\.


--
-- Data for Name: corridas_solicitadas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.corridas_solicitadas (id, motorista_id, tipo_servico, categoria_nome, valor_estimado, origem_endereco, destino_endereco, distancia_motorista_km, tempo_motorista_min, distancia_viagem_km, tempo_viagem_min, cliente_nome, cliente_rating, cliente_avaliacoes, status, criado_em, expira_em, corrida_id, lat_origem, lng_origem, lat_destino, lng_destino, forma_pagamento, motivo_cancelamento) FROM stdin;
1	2	corrida	GoTaxi Plus	18.50	R. Benedito Leite, 300 — Hortolândia	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	cancelada	2026-03-20 23:21:27.340582	2026-03-20 23:21:57.340582	\N	\N	\N	\N	\N	dinheiro	\N
2	2	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 - Centro	Av. Paulista, 1578 - Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	expirada	2026-03-20 23:35:44.061232	2026-03-20 23:36:14.061232	\N	\N	\N	\N	\N	dinheiro	\N
3	5	corrida	GoTaxi X	18.50	Shopping Hortolandia Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	aceita	2026-03-20 23:42:24.107914	2026-03-20 23:42:54.107914	\N	\N	\N	\N	\N	dinheiro	\N
4	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	aceita	2026-03-20 23:45:44.820071	2026-03-20 23:46:14.820071	\N	\N	\N	\N	\N	dinheiro	\N
5	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	aceita	2026-03-20 23:49:47.485688	2026-03-20 23:50:17.485688	\N	\N	\N	\N	\N	dinheiro	\N
6	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	aceita	2026-03-20 23:51:08.35472	2026-03-20 23:51:38.35472	\N	\N	\N	\N	\N	dinheiro	\N
7	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	recusada	2026-03-20 23:57:06.403123	2026-03-20 23:57:36.403123	\N	\N	\N	\N	\N	dinheiro	\N
8	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	recusada	2026-03-21 00:01:22.575841	2026-03-21 00:01:52.575841	\N	\N	\N	\N	\N	dinheiro	\N
9	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	aceita	2026-03-21 00:05:01.796876	2026-03-21 00:05:31.796876	\N	\N	\N	\N	\N	dinheiro	\N
15	5	corrida	economico	24.60	Centro Campinas	Aeroporto Viracopos	0.28	1	12.00	18	Teste Cliente	5.00	0	recusada	2026-03-23 16:39:19.820549	2026-03-23 16:40:19.820549	5	-22.89	-47.16	-23.006944	-47.134444	dinheiro	\N
10	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	finalizada	2026-03-21 00:19:20.646328	2026-03-21 00:19:50.646328	\N	\N	\N	\N	\N	dinheiro	\N
14	5	corrida	economico	24.60	Av. Paulista, São Paulo	Aeroporto de Campinas	0.28	1	12.00	18	Teste Cliente	5.00	0	recusada	2026-03-23 16:39:14.322882	2026-03-23 16:40:14.322882	4	-22.89	-47.16	-23.006944	-47.134444	dinheiro	\N
11	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	finalizada	2026-03-21 10:16:44.843972	2026-03-21 10:17:14.843972	\N	\N	\N	\N	\N	dinheiro	\N
16	5	corrida	economico	12.00	Rua XV de Novembro, Campinas	Shopping Iguatemi Campinas	10.33	21	5.00	8	Joana Teste	5.00	0	recusada	2026-03-23 16:40:27.121236	2026-03-23 16:41:27.121236	6	-22.9056	-47.0608	-22.9055	-47.0583	dinheiro	\N
12	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	finalizada	2026-03-21 12:07:54.552343	2026-03-21 12:08:24.552343	\N	\N	\N	\N	\N	dinheiro	\N
17	5	corrida	economico	10.20	Centro Campinas	PUC Campinas	10.33	21	4.00	6	Maria Teste	5.00	0	aceita	2026-03-23 16:41:45.418405	2026-03-23 16:42:45.418405	7	-22.9056	-47.0608	-22.9124	-47.0546	pix	\N
13	5	corrida	GoTaxi X	18.50	R. Benedito Leite, 300 — Centro	Av. Paulista, 1578 — Bela Vista, SP	1.70	5	5.80	13	Cliente Teste	4.95	466	finalizada	2026-03-21 12:30:21.67137	2026-03-21 12:30:51.67137	\N	\N	\N	\N	\N	dinheiro	\N
18	5	corrida	GoTaxi Plus	17.40	Campinas Centro	Barão Geraldo	10.33	21	8.00	12	Pedro Teste	5.00	0	finalizada	2026-03-23 16:44:43.964733	2026-03-23 16:45:43.964733	8	-22.9056	-47.0608	\N	\N	credito	\N
25	5	corrida	GoTaxi Plus	323.03	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Avenida Brigadeiro Faria Lima, 1534 - Jardim Paulistano, São Paulo - SP	0.00	0	89.44	134	Adérito Dutra Maciel	5.00	0	cancelada	2026-03-23 17:43:58.477832	2026-03-23 17:44:58.477832	15	-22.8924457	-47.1606417	-23.5711208	-46.6908622	pix	Outro motivo
21	5	corrida	GoTaxi X	25.72	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Shopping Hortolândia - Rua José Camilo de Camargo - Loteamento Remanso Campineiro, Hortolândia - SP	0.00	0	6.29	9	Adérito Dutra Maciel	5.00	0	finalizada	2026-03-23 16:50:30.821149	2026-03-23 16:51:30.821149	11	-22.8924425	-47.1606444	-22.8636357	-47.2134791	dinheiro	\N
19	5	corrida	GoTaxi X	25.72	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Shopping Hortolândia - Rua José Camilo de Camargo - Loteamento Remanso Campineiro, Hortolândia - SP	0.00	0	6.29	9	Adérito Dutra Maciel	5.00	0	finalizada	2026-03-23 16:45:15.934695	2026-03-23 16:46:15.934695	9	-22.8924425	-47.1606444	-22.8636357	-47.2134791	dinheiro	\N
20	5	corrida	GoTaxi X	15.60	Campinas Centro	Unicamp	10.33	21	7.00	11	Ana Oliveira	5.00	0	aceita	2026-03-23 16:49:22.908792	2026-03-23 16:50:22.908792	10	-22.9056	-47.0608	-22.8165	-47.0692	pix	\N
22	5	corrida	GoTaxi X	231.15	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Avenida Brigadeiro Faria Lima, 456 - Pinheiros, São Paulo - SP	0.00	0	88.46	133	Adérito Dutra Maciel	5.00	0	aceita	2026-03-23 16:56:46.377353	2026-03-23 16:57:46.377353	12	-22.8924425	-47.1606444	-23.5628147	-46.6945275	dinheiro	\N
23	5	corrida	GoTaxi X	34.11	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Campinas Shopping - Rua Jacy Teixeira de Camargo - Jardim do Lago, Campinas - SP	0.00	0	9.65	14	Adérito Dutra Maciel	5.00	0	finalizada	2026-03-23 17:11:01.251717	2026-03-23 17:12:01.251717	13	-22.8924425	-47.1606444	-22.9318768	-47.0767617	dinheiro	\N
24	5	corrida	GoTaxi X	44.16	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	SHOPPING IGUATEMI - Avenida Iguatemi - Vila Brandina, Campinas - SP	0.00	0	13.66	20	Adérito Dutra Maciel	5.00	0	finalizada	2026-03-23 17:20:57.962911	2026-03-23 17:21:57.962911	14	-22.8924435	-47.1606475	-22.8926086	-47.0272712	dinheiro	\N
28	5	corrida	GoTaxi X	233.38	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Avenida Brigadeiro Faria Lima, 1399 - Jardim Paulistano, São Paulo - SP	0.00	0	89.35	134	Su Dutra	5.00	0	recusada	2026-03-23 19:37:02.347739	2026-03-23 19:38:02.347739	18	-22.8924253	-47.1606596	-23.5702202	-46.69091969999999	dinheiro	\N
27	5	corrida	GoTaxi X	233.38	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Avenida Brigadeiro Faria Lima, 1399 - Jardim Paulistano, São Paulo - SP	0.00	0	89.35	134	Su Dutra	5.00	0	finalizada	2026-03-23 19:35:29.868553	2026-03-23 19:36:29.868553	17	-22.8924253	-47.1606596	-23.5702202	-46.69091969999999	dinheiro	\N
26	5	corrida	GoTaxi X	233.59	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Avenida Brigadeiro Faria Lima, 1534 - Jardim Paulistano, São Paulo - SP	0.00	0	89.44	134	Adérito Dutra Maciel	5.00	0	finalizada	2026-03-23 17:46:01.017442	2026-03-23 17:47:01.017442	16	-22.8924457	-47.1606417	-23.5711208	-46.6908622	pix	\N
29	5	corrida	GoTaxi X	233.38	Rua Antônia Ribeiro de Lima, 691, Parque São Jorge	Avenida Brigadeiro Faria Lima, 1399 - Jardim Paulistano, São Paulo - SP	0.00	0	89.35	134	Su Dutra	5.00	0	finalizada	2026-03-23 19:38:53.587124	2026-03-23 19:39:53.587124	19	-22.8924253	-47.1606596	-23.5702202	-46.69091969999999	dinheiro	\N
\.


--
-- Data for Name: empresas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.empresas (id, nome, codigo, logo, cor_primaria, plano, modulos_ativos, ativo, criado_em, ecommerce_status, ecommerce_taxa_comissao, ecommerce_categoria, responsavel, cnpj, telefone, email, endereco, tipo_pessoa, doc_rg, doc_rg_status, doc_cnpj, doc_cnpj_status, doc_selfie, doc_selfie_status, taxa_app, chave_pix, tipo_chave_pix, destaque, afiliado_origem_codigo, indicado_por) FROM stdin;
1	Loja Teste	TEST001	\N	#007AFF	basico	[]	t	2026-04-20 20:32:38.56265	ativo	10	\N	Tester	\N	11999999999	test@test.com	\N	empresa	\N	pendente	\N	pendente	\N	pendente	3	\N	aleatoria	f	\N	\N
3	Genesis Company 	GENESISC	\N	#007AFF	basico	["servicos"]	f	2026-03-23 12:50:25.706826	bloqueado	10	\N	\N	\N	\N	\N	\N	empresa	\N	pendente	\N	pendente	\N	pendente	3	\N	aleatoria	f	\N	\N
4	GoTaxi Sistema	GOTAXI-SISTEMA	\N	#007AFF	basico	[]	f	2026-03-27 21:34:20.442937	bloqueado	10	\N	\N	\N	\N	\N	\N	empresa	\N	pendente	\N	pendente	\N	pendente	3	\N	aleatoria	f	\N	\N
13	Transportadora Express	TRANS-DEMO	\N	#F59E0B	basico	["encomendas"]	t	2026-04-09 00:26:58.24287	ativo	10	\N	\N	\N	\N	\N	\N	empresa	\N	pendente	\N	pendente	\N	pendente	3	\N	aleatoria	f	\N	\N
5	Pizzaria Bella	BELLA-PIZZARIA	\N	#F97316	basico	["food","ecommerce","passagens"]	t	2026-03-27 21:42:21.010145	ativo	10	\N	\N	\N	\N	\N	\N	empresa	\N	pendente	\N	pendente	\N	pendente	3	bella@pizzaria.com	email	t	\N	\N
16	Su Manicure	SUMANCURE	\N	#EC4899	basico	["servicos"]	t	2026-04-12 16:13:48.556983	ativo	10	Estética & Beleza	\N	\N	\N	\N	\N	empresa	\N	pendente	\N	pendente	\N	pendente	3	\N	aleatoria	f	\N	\N
\.


--
-- Data for Name: empresas_corporativas_pendentes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.empresas_corporativas_pendentes (id, nome_fantasia, razao_social, cnpj, email_empresa, telefone_empresa, cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, responsavel_nome, responsavel_cpf, responsavel_cargo, responsavel_email, responsavel_telefone, qtde_funcionarios, limite_credito, observacoes, origem, afiliado_id, status, empresa_id_aprovada, usuario_id_aprovado, login_pdv, senha_pdv, motivo_rejeicao, criado_em, decidido_em, decidido_por) FROM stdin;
1	Empresa Teste	\N	00.000.000/0001-00	teste@empresa.com	\N	\N	\N	\N	\N	\N	\N	\N	João	\N	\N	\N	\N	\N	5000.00	\N	admin	\N	pendente	\N	\N	\N	\N	\N	2026-04-27 17:38:52.564476	\N	\N
2	Empresa B	\N	11.222.333/0001-44	contato@empresab.com	\N	\N	\N	\N	\N	\N	\N	\N	Maria	\N	\N	\N	\N	\N	10000.00	\N	admin	\N	pendente	\N	\N	\N	\N	\N	2026-04-27 17:42:46.055838	\N	\N
\.


--
-- Data for Name: encomendas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.encomendas (id, empresa_id, codigo, cliente_id, cliente_nome, cliente_telefone, cliente_documento, origem_endereco, destino_endereco, destino_bairro, destino_cidade, tipo_pacote, peso_kg, valor_declarado, valor_frete, tipo_servico, data_envio, data_previsao, status, forma_pagamento, observacoes, operador_nome, criado_em, atualizado_em) FROM stdin;
1	5	ENK-00001	\N	Maria Silva	(33)99101-2233	\N	Rua das Flores 10, GV	Rua Central 45	\N	Belo Horizonte	pequeno	0.5	0	25	normal	\N	\N	entregue	pix	\N	Operador Demo	2026-04-08 21:57:08.101235	2026-04-08 21:57:08.101235
2	5	ENK-00002	\N	João Ferreira	(31)98765-4321	\N	Av. Brasil 200, GV	Rua XV 88	\N	Rio de Janeiro	medio	2.3	0	65	expresso	\N	\N	em_transporte	dinheiro	\N	Operador Demo	2026-04-08 21:57:08.101235	2026-04-08 21:57:08.101235
3	5	ENK-00003	\N	Ana Oliveira	(33)97654-3210	\N	Praça da Sé 1, GV	Rua das Palmeiras 33	\N	São Paulo	grande	5.1	0	120	expresso	\N	\N	saiu_entrega	credito	\N	Operador Demo	2026-04-08 21:57:08.101235	2026-04-08 21:57:08.101235
4	5	ENK-00004	\N	Carlos Santos	(31)96543-2109	\N	Rua Dom Pedro 5, GV	Av. Atlântica 1000	\N	Vitória	documento	0.1	0	15	normal	\N	\N	pendente	dinheiro	\N	Operador Demo	2026-04-08 21:57:08.101235	2026-04-08 21:57:08.101235
\.


--
-- Data for Name: encomendas_clientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.encomendas_clientes (id, empresa_id, nome, telefone, documento, endereco, cidade, criado_em) FROM stdin;
1	13	João Pereira	11999001234	123.456.789-00	Rua das Flores 45	São Paulo	2026-04-09 11:15:53.509029
2	13	Maria Souza	11988002345	987.654.321-00	Av. Paulista 1000	São Paulo	2026-04-09 11:15:53.509029
3	13	Carlos Oliveira	11977003456	456.789.123-00	Rua Augusta 500	Campinas	2026-04-09 11:15:53.509029
4	13	Ana Lima	11966004567	654.321.987-00	Rua XV de Novembro 200	Santos	2026-04-09 11:15:53.509029
\.


--
-- Data for Name: encomendas_historico; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.encomendas_historico (id, encomenda_id, status, descricao, operador_nome, registrado_em) FROM stdin;
1	1	coletado	Encomenda coletada no remetente	Operador Demo	2026-04-08 21:57:08.101235
2	1	em_transporte	Em rota para destino	Operador Demo	2026-04-08 21:57:08.101235
3	1	entregue	Entregue ao destinatário	Operador Demo	2026-04-08 21:57:08.101235
\.


--
-- Data for Name: entregas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entregas (id, empresa_id, remetente_nome, remetente_telefone, destinatario_nome, destinatario_telefone, endereco_coleta, endereco_entrega, descricao_pacote, status, entregador_nome, valor, criado_em, categoria, distancia_km, coleta_lat, coleta_lng, entrega_lat, entrega_lng, motorista_id) FROM stdin;
2	\N	João Silva	11999999999	\N	\N	Rua A, 100, São Paulo	Rua B, 200, São Paulo	Caixa pequena	pendente	\N	0	2026-04-12 11:25:17.835744	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: entregas_solicitadas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entregas_solicitadas (id, profissional_id, tipo_servico, categoria_nome, valor_estimado, coleta_endereco, entrega_endereco, distancia_profissional_km, tempo_profissional_min, distancia_entrega_km, tempo_entrega_min, cliente_nome, cliente_rating, cliente_avaliacoes, descricao_item, status, criado_em, expira_em, entrega_id, pedido_pdv_id, empresa_id) FROM stdin;
1	5	entrega	Entrega Padrão	15.00	R. Augusta, 500 — Consolação, São Paulo	Av. Paulista, 1578 — Bela Vista, São Paulo	0.80	3	2.40	8	Cliente Teste	4.90	212	Encomenda pequena	expirada	2026-03-21 00:46:44.178286	2026-03-21 00:47:14.178286	\N	\N	\N
2	3	delivery	Delivery Padrão	22.00	R. Augusta, 500 — Consolação, São Paulo	Av. Paulista, 1578 — Bela Vista, São Paulo	0.50	2	1.80	6	Cliente Teste	4.90	212	Pedido de comida	finalizada	2026-03-21 00:48:24.822652	2026-03-21 00:48:54.822652	\N	\N	\N
3	4	entrega	Entrega Padrão	15.00	R. Augusta, 500 — Consolação, São Paulo	Av. Paulista, 1578 — Bela Vista, São Paulo	0.80	3	2.40	8	Cliente Teste	4.90	212	Encomenda pequena	finalizada	2026-03-21 00:54:15.695542	2026-03-21 00:54:45.695542	\N	\N	\N
\.


--
-- Data for Name: extras_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.extras_pdv (id, empresa_id, nome, preco, ativo, obrigatorio) FROM stdin;
\.


--
-- Data for Name: financeiro_lancamentos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.financeiro_lancamentos (id, empresa_id, tipo, valor, descricao, categoria, data, observacoes, created_at) FROM stdin;
1	5	despesa	350.00	Aluguel maio	aluguel	2026-05-01	\N	2026-05-04 18:22:43.293602+00
2	5	despesa	147.50	Compra: Distribuidora São Paulo - NF 1234	fornecedor	2026-05-04	NF 1234	2026-05-04 19:32:02.769088+00
\.


--
-- Data for Name: fornecedores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fornecedores (id, empresa_id, nome, categoria, telefone, email, observacoes, ativo, created_at) FROM stdin;
1	5	Distribuidora São Paulo	alimentacao	(11) 99999-1111	sp@dist.com	\N	t	2026-05-04 19:32:02.666269+00
\.


--
-- Data for Name: gotatxi_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gotatxi_config (chave, valor, updated_at) FROM stdin;
ia_suporte_prompt	Você é a Gô, assistente virtual da GoTaxi. Responda em PT-BR, seja simpática e direta.	2026-05-04 19:19:16.681449+00
\.


--
-- Data for Name: grupos_extras_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grupos_extras_pdv (id, empresa_id, nome, min_selecoes, max_selecoes, obrigatorio, ordem, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: itens_cardapio; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.itens_cardapio (id, restaurante_id, nome, descricao, preco, categoria, imagem, disponivel) FROM stdin;
\.


--
-- Data for Name: itens_pedido; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.itens_pedido (id, pedido_id, produto_nome, quantidade, preco_unitario, total, observacoes) FROM stdin;
\.


--
-- Data for Name: itens_pedido_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.itens_pedido_pdv (id, pedido_id, produto_nome, quantidade, preco_unitario, total, observacoes) FROM stdin;
14	9	X-Burguer	2	25	50	sem cebola
15	10	Camiseta P	1	0	0	\N
16	11	Pizza Margherita	1	45.5	45.5	\N
\.


--
-- Data for Name: modelo_categorias; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.modelo_categorias (modelo_id, categoria_id) FROM stdin;
1	1
1	2
1	3
4	1
3	1
3	2
3	3
2	1
\.


--
-- Data for Name: modelos_veiculo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.modelos_veiculo (id, nome, ano_minimo, ativo, criado_em) FROM stdin;
1	Toyota Corolla	2015	t	2026-03-20 22:29:00.032896
4	Fiat Uno	2015	t	2026-03-20 22:29:00.210108
3	Honda Civic	2015	t	2026-03-20 22:29:00.146369
2	VW Gol	2015	t	2026-03-20 22:29:00.091008
\.


--
-- Data for Name: motivos_cancelamento; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.motivos_cancelamento (id, texto, ativo, criado_em) FROM stdin;
1	Passageiro não estava no local	t	2026-03-23 17:33:40.836855
2	Passageiro solicitou cancelamento	t	2026-03-23 17:33:40.836855
3	Problema com o veículo	t	2026-03-23 17:33:40.836855
4	Rota perigosa ou inacessível	t	2026-03-23 17:33:40.836855
5	Emergência pessoal	t	2026-03-23 17:33:40.836855
6	Outro motivo	t	2026-03-23 17:33:40.836855
\.


--
-- Data for Name: motorista_categorias; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.motorista_categorias (motorista_id, categoria_id, categoria_nome) FROM stdin;
1	1	GoTaxi X
1	2	GoTaxi Plus
1	3	GoTaxi Black
5	1	GoTaxi X
5	2	GoTaxi Plus
5	3	GoTaxi Black
\.


--
-- Data for Name: motoristas_app; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.motoristas_app (id, nome, cpf, telefone, email, senha_pin, foto, status, cidade, estado, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_cor, veiculo_placa, tipo_veiculo, doc_cnh, doc_cnh_status, doc_veiculo, doc_veiculo_status, doc_selfie, doc_selfie_status, ativo, percentual_repasse, saldo, total_ganhos, total_corridas, avaliacao_media, criado_em, atualizado_em, tipo_profissional, doc_antecedentes, doc_antecedentes_status, doc_rg, doc_rg_status, status_repasse, fcm_token, pix_tipo, pix_chave, pix_imagem_url, online, lat, lng, ultimo_ping, codigo_referral, indicado_por) FROM stdin;
1	Carlos Motorista	\N	11999990001	\N	1234	\N	aprovado	\N	\N	\N	Honda Civic	2016	\N	\N	economico	\N	aprovado	\N	aprovado	\N	aprovado	t	3	0	0	0	0	2026-03-20 01:33:12.323879	2026-03-21 10:15:34.415455	motorista	\N	pendente	\N	pendente	ok	\N	cpf	\N	\N	f	\N	\N	\N	CARL0001	\N
5	Adérito Dutra Maciel	03984795858	11942377344	\N	8441	\N	aprovado	\N	\N	\N	Honda Civic	2025	Prata 	BB4456	economico	\N	aprovado	\N	aprovado	\N	aprovado	t	3	893.81616	921.46	12	0	2026-03-20 20:51:01.293731	2026-03-23 16:41:17.122341	motorista	\N	aprovado	\N	pendente	bloqueado	\N	cpf	03984795858	\N	t	-22.9015	-47.0608	2026-04-26 21:57:53.053152	ADRI0005	\N
\.


--
-- Data for Name: motoristas_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.motoristas_pdv (id, empresa_id, nome, telefone, veiculo, placa, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: opcoes_grupo_extras_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.opcoes_grupo_extras_pdv (id, grupo_id, nome, preco_adicional, ativo, ordem) FROM stdin;
\.


--
-- Data for Name: pedidos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pedidos (id, empresa_id, cliente_nome, cliente_telefone, itens, total, status, endereco_entrega, criado_em) FROM stdin;
4	5	Maria Souza		[{"nome":"Camiseta P","quantidade":1,"preco":0}]	89.9	pendente	Av. Paulista, 100	2026-05-04 19:42:57.108327
\.


--
-- Data for Name: pedidos_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pedidos_pdv (id, empresa_id, modulo, tipo, status, cliente_nome, cliente_whatsapp, cliente_endereco, mesa, total, observacoes, forma_pagamento, criado_em, atualizado_em, confirmado_em, preparando_em, pronto_em, entregue_em, taxa_entrega, distancia_km, boy_id, comprovante_pix) FROM stdin;
9	5	food	delivery	pendente	João Silva	(11) 91234-5678	Rua das Flores, 123	\N	50		pix	2026-05-04 19:42:56.955059	2026-05-04 19:42:56.955059	\N	\N	\N	\N	5	\N	\N	\N
10	5	ecommerce	delivery	novo	Maria Souza	\N	Av. Paulista, 100	\N	89.9	\N	pix	2026-05-04 19:42:57.119131	2026-05-04 19:42:57.119131	\N	\N	\N	\N	0	\N	\N	\N
11	5	food	mesa	novo	Ana Lima	\N	\N	5	45.5	\N	dinheiro	2026-05-04 19:42:59.119072	2026-05-04 19:42:59.119072	\N	\N	\N	\N	0	\N	\N	\N
\.


--
-- Data for Name: pro_agendamentos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pro_agendamentos (id, tipo, profissional_id, data_hora, local_embarque, local_destino, valor, cliente_nome, cliente_whatsapp, observacoes, status, criado_em) FROM stdin;
\.


--
-- Data for Name: pro_aprovacoes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pro_aprovacoes (id, corrida_id, aprovador_nome, acao, observacao, criado_em) FROM stdin;
\.


--
-- Data for Name: pro_centros_custo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pro_centros_custo (id, empresa_id, nome, descricao, limite_mensal, gasto_mes_atual, mes_referencia, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: pro_corridas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pro_corridas (id, empresa_id, funcionario_id, centro_custo_id, passageiro_nome, passageiro_telefone, origem, origem_lat, origem_lng, destino, destino_lat, destino_lng, motivo, tipo, data_agendamento, valor_estimado, valor_final, distancia_km, status, motorista_id, observacoes, criado_em, atualizado_em, corrida_id, motoristas_chamados, chamado_em) FROM stdin;
\.


--
-- Data for Name: pro_faturas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pro_faturas (id, empresa_id, mes_referencia, total_corridas, valor_total, status, pdf_path, criado_em, fechada_em, paga_em) FROM stdin;
\.


--
-- Data for Name: pro_funcionarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pro_funcionarios (id, empresa_id, centro_custo_id, nome, email, cargo, telefone, pode_solicitar, precisa_aprovacao, limite_corrida, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: produto_extras_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.produto_extras_pdv (produto_id, extra_id) FROM stdin;
\.


--
-- Data for Name: produto_grupos_extras_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.produto_grupos_extras_pdv (produto_id, grupo_id, ordem) FROM stdin;
\.


--
-- Data for Name: produtos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.produtos (id, empresa_id, nome, descricao, preco, preco_promocional, estoque, categoria, imagem, ativo, criado_em) FROM stdin;
7	5	Camiseta Pizzaria Bella	Camiseta do time Pizzaria Bella	45	\N	30	Vestuário	\N	t	2026-04-12 15:27:37.806875
8	5	Kit Temperos	Kit com 3 temperos especiais	32	29	60	Alimentos	\N	t	2026-04-12 15:27:37.806875
9	5	Caneca Personalizada	Caneca branca personalizada 300ml	28	\N	40	Utilidades	\N	t	2026-04-12 15:27:37.806875
\.


--
-- Data for Name: produtos_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.produtos_pdv (id, empresa_id, categoria_id, nome, descricao, preco, imagem, ativo, criado_em, tamanhos) FROM stdin;
19	5	11	Pizza Margherita	Molho de tomate, mozzarella fresca e manjericão	45	\N	t	2026-04-09 11:14:29.68722	\N
20	5	11	Pizza Calabresa	Molho, calabresa fatiada, cebola e azeitona	48	\N	t	2026-04-09 11:14:29.68722	\N
21	5	11	Pizza Frango com Catupiry	Frango desfiado, catupiry e milho	52	\N	t	2026-04-09 11:14:29.68722	\N
22	5	11	Pizza Portuguesa	4 queijos, ovo, presunto e azeitona	55	\N	t	2026-04-09 11:14:29.68722	\N
23	5	12	Pizza Romeu e Julieta	Goiabada com mozzarella	44	\N	t	2026-04-09 11:14:29.68722	\N
24	5	12	Pizza Nutella	Nutella com morangos frescos e granola	50	\N	t	2026-04-09 11:14:29.68722	\N
25	5	13	Espaguete à Bolonhesa	Macarrão artesanal com ragú de carne	39	\N	t	2026-04-09 11:14:29.68722	\N
26	5	13	Fettuccine Alfredo	Creme de parmesão com champignon	42	\N	t	2026-04-09 11:14:29.68722	\N
27	5	14	Refrigerante 2L	Coca-Cola, Pepsi ou Guaraná	12	\N	t	2026-04-09 11:14:29.68722	\N
28	5	14	Suco de Uva 1L	Suco natural sem conservantes	18	\N	t	2026-04-09 11:14:29.68722	\N
\.


--
-- Data for Name: promocoes_pdv; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.promocoes_pdv (id, empresa_id, nome, descricao, tipo, valor, codigo_cupom, min_pedido, ativo, validade, criado_em, produto_id, preco_promocional, quantidade_disponivel) FROM stdin;
\.


--
-- Data for Name: push_historico; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.push_historico (id, titulo, mensagem, modulo, total_tokens, total_enviado, criado_em) FROM stdin;
\.


--
-- Data for Name: push_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.push_tokens (id, usuario_id, token, plataforma, modulos, ativo, criado_em, atualizado_em) FROM stdin;
\.


--
-- Data for Name: repasses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repasses (id, empresa_id, semana_inicio, semana_fim, receita_total, taxa_percentual, valor_repasse, status, pago_em, ativado_por, criado_em, comprovante_path, comprovante_enviado_em, comprovante_observacao) FROM stdin;
61	3	2026-04-06	2026-04-12	0.00	3.00	0.00	pendente	\N	\N	2026-04-08 21:10:39.960051	\N	\N	\N
62	4	2026-04-06	2026-04-12	0.00	3.00	0.00	pendente	\N	\N	2026-04-08 21:10:39.962567	\N	\N	\N
55	5	2026-04-06	2026-04-12	80.00	3.00	2.40	pago	2026-04-12 19:40:47.491008	\N	2026-04-08 20:47:03.818949	\N	\N	\N
56	5	2026-03-30	2026-04-05	0.00	3.00	0.00	pago	2026-04-12 19:40:51.743252	\N	2026-04-08 20:47:03.86139	\N	\N	\N
\.


--
-- Data for Name: repasses_corporativos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repasses_corporativos (id, empresa_id, semana_inicio, semana_fim, total_corridas, valor_total, status, vencimento, pago_em, comprovante_url, observacoes, criado_em, atualizado_em) FROM stdin;
\.


--
-- Data for Name: repasses_pro; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repasses_pro (id, profissional_id, tipo_profissional, semana_inicio, semana_fim, total_ganhos, percentual, valor_repasse, status, comprovante, pago_em, criado_em) FROM stdin;
2	2	motorista	2026-03-16	2026-03-22	0	3	0	pendente	\N	\N	2026-03-20 22:00:55.305128
20	4	entregador	2026-03-16	2026-03-22	0	3	0	pendente	\N	\N	2026-03-21 00:53:45.971795
19	3	delivery	2026-03-16	2026-03-22	0	3	0	pendente	\N	\N	2026-03-21 00:48:05.525379
1	5	motorista	2026-03-16	2026-03-22	37	3	1.11	bloqueado	\N	\N	2026-03-20 22:00:55.153725
28	5	motorista	2026-03-23	2026-03-29	74	3	2.22	pendente	\N	\N	2026-03-23 16:36:05.514694
29	5	motorista	2026-04-06	2026-04-12	921.46	3	27.64	pendente	\N	\N	2026-04-12 11:35:51.633675
\.


--
-- Data for Name: reservas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reservas (id, empresa_id, rota_id, passageiro_nome, passageiro_documento, passageiro_telefone, assento, status, total, criado_em) FROM stdin;
\.


--
-- Data for Name: restaurantes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.restaurantes (id, empresa_id, nome, descricao, categoria, tempo_entrega_min, avaliacao_media, taxa_entrega, aberto, imagem, criado_em, lat_loja, lng_loja, raio_visibilidade_km, status, plano, taxa_comissao, telefone, email, responsavel, cnpj, endereco, tipo_pessoa, doc_rg, doc_rg_status, doc_cnpj, doc_cnpj_status, doc_selfie, doc_selfie_status, subcategoria_id) FROM stdin;
8	5	Pizzaria Bella	A melhor pizza da região, feita em forno a lenha	Pizzaria e Massas	40	\N	6	t	\N	2026-04-09 11:14:03.21301	\N	\N	50.00	ativo	free	10	\N	\N	\N	\N	\N	empresa	\N	pendente	\N	pendente	\N	pendente	\N
\.


--
-- Data for Name: rotas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rotas (id, empresa_id, origem, destino, horario_partida, horario_chegada, preco, assentos_disponiveis, total_assentos, empresa_nome, criado_em, status, plano, taxa_comissao, tipo, telefone, email, responsavel, cnpj, cidade, estado, doc_cnpj, doc_cnpj_status, doc_cnh, doc_cnh_status, doc_crlv, doc_crlv_status, doc_selfie, doc_selfie_status) FROM stdin;
\.


--
-- Data for Name: servicos_catalogo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servicos_catalogo (id, empresa_id, prestador_id, categoria_id, nome, descricao, duracao_minutos, preco, ativo, criado_em) FROM stdin;
1	5	1	4	Corte de Cabelo	Corte masculino ou feminino	45	80.00	t	2026-04-08 23:31:13.424566
2	5	1	4	Coloração	Coloração completa	120	180.00	t	2026-04-08 23:31:13.424566
3	5	2	6	Massagem Relaxante	Massagem corporal 60min	60	120.00	t	2026-04-08 23:31:13.424566
4	5	2	4	Limpeza de Pele	Limpeza profunda facial	60	95.00	t	2026-04-08 23:31:13.424566
5	5	3	5	Manutenção Hidráulica	Conserto de vazamentos	90	150.00	t	2026-04-08 23:31:13.424566
6	5	3	5	Instalação Elétrica	Troca de tomadas e interruptores	60	120.00	t	2026-04-08 23:31:13.424566
7	16	4	7	Manicure Simples	Esmaltação comum, cutícula e lixamento	45	30.00	t	2026-04-12 16:15:22.034126
8	16	4	7	Manicure em Gel	Alongamento e esmaltação em gel	90	80.00	t	2026-04-12 16:15:25.977343
9	16	4	7	Nail Art	Arte em unhas com designs personalizados	60	60.00	t	2026-04-12 16:15:30.100291
10	16	4	8	Pedicure Simples	Esmaltação, cutícula e cuidado dos pés	60	40.00	t	2026-04-12 16:15:33.869952
11	16	4	8	Pedicure Completa	Tratamento completo com hidratação e esfoliação	75	65.00	t	2026-04-12 16:15:37.695775
\.


--
-- Data for Name: servicos_pacotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servicos_pacotes (id, empresa_id, nome, descricao, preco_total, sessoes, validade_dias, catalogo_ids, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: servicos_prestadores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servicos_prestadores (id, empresa_id, nome, especialidade, telefone, email, bio, avatar_url, ativo, bloqueado, motivo_bloqueio, criado_em) FROM stdin;
1	5	Marcos Silva	Cabeleireiro	11987650001	\N	\N	\N	t	f	\N	2026-04-08 23:31:00.838129
2	5	Ana Paula	Esteticista	11987650002	\N	\N	\N	t	f	\N	2026-04-08 23:31:00.838129
3	5	Paulo Santos	Encanador	11987650003	\N	\N	\N	t	f	\N	2026-04-08 23:31:00.838129
4	16	Su	Manicure & Pedicure		\N	Especialista em unhas com 5 anos de experiência	\N	t	f	\N	2026-04-12 16:15:06.572911
\.


--
-- Data for Name: servicos_promocoes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servicos_promocoes (id, empresa_id, nome, descricao, tipo, valor, valido_de, valido_ate, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: subcategorias_alimentacao; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subcategorias_alimentacao (id, nome, slug, emoji, ordem, ativo, criado_em) FROM stdin;
1	Pizzaria	pizzaria	🍕	1	t	2026-04-30 13:57:57.432204
2	Hamburgueria	hamburgueria	🍔	2	t	2026-04-30 13:57:57.432204
3	Restaurante	restaurante	🍽️	3	t	2026-04-30 13:57:57.432204
4	Padaria	padaria	🥐	4	t	2026-04-30 13:57:57.432204
5	Lanchonete	lanchonete	🥪	5	t	2026-04-30 13:57:57.432204
6	Marmitaria	marmitaria	🍱	6	t	2026-04-30 13:57:57.432204
7	Bolos e Doces	bolos-doces	🍰	7	t	2026-04-30 13:57:57.432204
8	Churrascaria	churrascaria	🥩	8	t	2026-04-30 13:57:57.432204
9	Açaí e Sorvetes	acai-sorvetes	🍨	9	t	2026-04-30 13:57:57.432204
10	Sushi e Japonesa	sushi-japonesa	🍣	10	t	2026-04-30 13:57:57.432204
11	Comida Caseira	comida-caseira	🏠	11	t	2026-04-30 13:57:57.432204
12	Cafeteria	cafeteria	☕	12	t	2026-04-30 13:57:57.432204
13	Coxinharia	coxinharia	🥟	13	t	2026-04-30 13:57:57.432204
14	Sorveteria	sorveteria	🍦	14	t	2026-04-30 13:57:57.432204
\.


--
-- Data for Name: suporte_mensagens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suporte_mensagens (id, ticket_id, remetente, mensagem, lida, created_at) FROM stdin;
1	1	loja	Cadastrei um produto mas ele nao aparece no app do cliente. Como resolver?	f	2026-05-04 19:00:47.022634+00
2	2	loja	Cadastrei um produto mas ele nao aparece no app do cliente. Como resolver?	f	2026-05-04 19:03:18.162203+00
3	2	ia	Vamos conferir alguns pontos que normalmente impedem o produto de aparecer no app do cliente:\n\n1. **Verifique o status do produto e do cardápio**  \n   - No PDV (painel do parceiro), acesse **Cardápio / Produtos** e veja se o produto está como **Ativo** (não “oculto”, “rascunho” ou “indisponível”).  \n   - Confirme se ele está vinculado a uma **categoria ativa** e a um **cardápio** que esteja publicado para o módulo correto (Food Delivery, E-commerce etc.).\n\n2. **Checar horários, estoque e disponibilidade**  \n   - Veja se o produto não está limitado por **horário de funcionamento** (ex.: só aparece em determinado horário ou dia) ou por **agendamento**.  \n   - Confirme se ele tem **estoque disponível** (se o controle de estoque estiver ativo) e se a sua **loja está online/aberta** no app do cliente.\n\n3. **Atualização no app e filtros**  \n   - Peça para o cliente **fechar e abrir o app** novamente ou limpar o cache (se for PWA/web app).  \n   - Verifique se o produto não está em uma categoria que o cliente está filtrando sem perceber (ex.: categoria diferente, filtro de busca).\n\nSe quiser, me diga: o módulo que você usa é **Food Delivery** ou **E-commerce**, e se o produto está marcado como ativo no painel. Se mesmo assim não aparecer, vou registrar para que um atendente humano verifique o seu caso direto no sistema.	t	2026-05-04 19:03:23.247398+00
4	3	loja	Como configuro meu horário de funcionamento?	f	2026-05-04 19:07:34.392834+00
5	3	ia	Para configurar seu horário de funcionamento, acesse o painel do parceiro (PDV) e vá até a seção de configurações. Lá, você deve procurar pela opção de "Horários de funcionamento" ou "Horários de atendimento". \n\nNessa área, é possível definir os dias da semana e os horários específicos em que seu estabelecimento estará aberto. Após fazer as alterações, lembre-se de salvar para que as configurações tenham validade. \n\nCaso precise de um passo a passo detalhado ou encontre alguma dificuldade, posso verificar para você ou encaminhar para um atendente humano.	t	2026-05-04 19:07:35.724451+00
6	4	loja	Como funciona o repasse?	f	2026-05-04 20:27:03.992609+00
7	4	ia	Olá! O repasse na GoTaxi funciona assim: após cada corrida, o valor da tarifa é recebido pela plataforma e, em seguida, transferido para sua conta, descontando as taxas e comissões acordadas. O pagamento costuma ocorrer em um prazo curto, geralmente em até 24 horas. Se quiser, posso te passar detalhes específicos do seu contrato. É só pedir!	f	2026-05-04 20:27:05.462319+00
\.


--
-- Data for Name: suporte_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suporte_tickets (id, empresa_id, empresa_nome, titulo, status, prioridade, categoria, nao_lidas_admin, nao_lidas_loja, ultima_mensagem, ultima_at, created_at) FROM stdin;
1	5	Acai Tucao e Sorvetes	Produto nao aparece no cardapio	aberto	alta	cardapio	1	0	Cadastrei um produto mas ele nao aparece no app do cliente. Como resolver?	2026-05-04 19:00:47.003929+00	2026-05-04 19:00:47.003929+00
2	5	Acai Tucao e Sorvetes	Produto nao aparece no cardapio	aberto	alta	cardapio	1	0	Vamos conferir alguns pontos que normalmente impedem o produto de aparecer no app do cliente:\n\n1. **Verifique o status do produto e do cardápio**  \n   - No PDV (painel do parceiro), acesse **Cardápio / Produtos** e veja se o produto está como **Ativo** (não “oculto”, “rascunho” ou “indisponível”).  \n   - Confirme se ele está vinculado a uma **categoria ativa** e a um **cardápio** que esteja publicado para o módulo correto (Food Delivery, E-commerce etc.).\n\n2. **Checar horários, estoque e disponibilidade**  \n   - Veja se o produto não está limitado por **horário de funcionamento** (ex.: só aparece em determinado horário ou dia) ou por **agendamento**.  \n   - Confirme se ele tem **estoque disponível** (se o controle de estoque estiver ativo) e se a sua **loja está online/aberta** no app do cliente.\n\n3. **Atualização no app e filtros**  \n   - Peça para o cliente **fechar e abrir o app** novamente ou limpar o cache (se for PWA/web app).  \n   - Verifique se o produto não está em uma categoria que o cliente está filtrando sem perceber (ex.: categoria diferente, filtro de busca).\n\nSe quiser, me diga: o módulo que você usa é **Food Delivery** ou **E-commerce**, e se o produto está marcado como ativo no painel. Se mesmo assim não aparecer, vou registrar para que um atendente humano verifique o seu caso direto no sistema.	2026-05-04 19:03:23.250035+00	2026-05-04 19:03:18.157857+00
3	7	Teste	Teste nano	aberto	normal	geral	1	0	Para configurar seu horário de funcionamento, acesse o painel do parceiro (PDV) e vá até a seção de configurações. Lá, você deve procurar pela opção de "Horários de funcionamento" ou "Horários de atendimento". \n\nNessa área, é possível definir os dias da semana e os horários específicos em que seu estabelecimento estará aberto. Após fazer as alterações, lembre-se de salvar para que as configurações tenham validade. \n\nCaso precise de um passo a passo detalhado ou encontre alguma dificuldade, posso verificar para você ou encaminhar para um atendente humano.	2026-05-04 19:07:35.727124+00	2026-05-04 19:07:34.388652+00
4	1	Teste	Teste ticket	aberto	normal	geral	1	1	Olá! O repasse na GoTaxi funciona assim: após cada corrida, o valor da tarifa é recebido pela plataforma e, em seguida, transferido para sua conta, descontando as taxas e comissões acordadas. O pagamento costuma ocorrer em um prazo curto, geralmente em até 24 horas. Se quiser, posso te passar detalhes específicos do seu contrato. É só pedir!	2026-05-04 20:27:05.478339+00	2026-05-04 20:27:03.696247+00
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id, nome, email, senha_hash, telefone, avatar, papel, empresa_id, ativo, criado_em, endereco, forma_pagamento, afiliado_origem_codigo, codigo_referral, indicado_por, credito_aplicativo) FROM stdin;
1	Admin GoTaxi	admin@gotaxi.com	$2b$10$o4NKvMXlubmowq4ajetiUuEw9heShLFSE4fi7kO8aLLQbBV/WYily	\N	\N	parceiro	4	t	2026-03-14 20:44:39.244451	\N	\N	\N	ADMI0001	\N	0.00
2	Bella Silva	bella@pizzaria.com	123456	\N	\N	parceiro	5	t	2026-03-19 21:41:19.162084	\N	\N	\N	BELL0002	\N	0.00
13	Su Mancure	sumanicure@gotaxi.com.br	123456		\N	parceiro	16	t	2026-04-12 16:14:42.023053	\N	\N	\N	SUMA0013	\N	0.00
\.


--
-- Data for Name: viagens_clientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.viagens_clientes (id, empresa_id, nome, cpf, telefone, email, data_nascimento, criado_em) FROM stdin;
1	5	João Silva	123.456.789-00	(33) 98765-4321	joao@email.com	\N	2026-04-08 21:30:56.03902
2	5	Maria Santos	987.654.321-00	(33) 91234-5678	maria@email.com	\N	2026-04-08 21:30:56.03902
3	5	Pedro Costa	456.789.123-00	(33) 99876-5432	pedro@email.com	\N	2026-04-08 21:30:56.03902
4	5	Ana Oliveira	321.654.987-00	(33) 98765-1234	ana@email.com	\N	2026-04-08 21:30:56.03902
\.


--
-- Data for Name: viagens_horarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.viagens_horarios (id, rota_id, empresa_id, data_partida, hora_partida, hora_chegada, vagas_total, vagas_ocupadas, preco, veiculo, ativo, criado_em) FROM stdin;
1	1	5	2026-04-08	06:00:00	10:00:00	40	12	85.00	ABC-1234	t	2026-04-08 21:30:56.03902
2	1	5	2026-04-08	10:00:00	14:00:00	40	5	85.00	DEF-5678	t	2026-04-08 21:30:56.03902
3	1	5	2026-04-08	14:00:00	18:00:00	40	30	85.00	GHI-9012	t	2026-04-08 21:30:56.03902
4	2	5	2026-04-08	07:00:00	14:00:00	44	8	130.00	JKL-3456	t	2026-04-08 21:30:56.03902
5	3	5	2026-04-09	08:00:00	14:00:00	44	20	150.00	MNO-7890	t	2026-04-08 21:30:56.03902
\.


--
-- Data for Name: viagens_passagens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.viagens_passagens (id, empresa_id, cliente_id, horario_id, assento, valor, forma_pagamento, status, observacoes, operador_nome, vendido_em, usuario_id) FROM stdin;
1	5	1	1	12A	85.00	pix	confirmado	\N	Admin	2026-04-08 21:30:56.03902	\N
2	5	2	4	5B	130.00	credito	confirmado	\N	Admin	2026-04-08 21:30:56.03902	\N
3	5	3	1	22C	85.00	dinheiro	pendente	\N	Admin	2026-04-08 21:30:56.03902	\N
4	5	4	2	8D	85.00	pix	confirmado	\N	Admin	2026-04-08 21:30:56.03902	\N
\.


--
-- Data for Name: viagens_rotas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.viagens_rotas (id, empresa_id, origem, destino, duracao_minutos, tipo, ativo, criado_em) FROM stdin;
1	5	Governador Valadares	Belo Horizonte	240	onibus	t	2026-04-08 21:30:56.03902
2	5	Governador Valadares	Rio de Janeiro	420	onibus	t	2026-04-08 21:30:56.03902
3	5	Belo Horizonte	São Paulo	360	onibus	t	2026-04-08 21:30:56.03902
4	5	Governador Valadares	Vitória	300	onibus	t	2026-04-08 21:30:56.03902
\.


--
-- Name: afiliado_comissoes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.afiliado_comissoes_id_seq', 1, true);


--
-- Name: afiliado_indicacoes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.afiliado_indicacoes_id_seq', 2, true);


--
-- Name: afiliado_resgates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.afiliado_resgates_id_seq', 1, false);


--
-- Name: afiliados_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.afiliados_config_id_seq', 1, true);


--
-- Name: afiliados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.afiliados_id_seq', 4, true);


--
-- Name: agendamentos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.agendamentos_id_seq', 2, true);


--
-- Name: carona_paradas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carona_paradas_id_seq', 1, false);


--
-- Name: carona_reservas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carona_reservas_id_seq', 1, false);


--
-- Name: carona_veiculos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carona_veiculos_id_seq', 1, false);


--
-- Name: caronas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.caronas_id_seq', 1, false);


--
-- Name: categorias_corrida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorias_corrida_id_seq', 3, true);


--
-- Name: categorias_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorias_pdv_id_seq', 17, true);


--
-- Name: categorias_servicos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categorias_servicos_id_seq', 8, true);


--
-- Name: chat_conversas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_conversas_id_seq', 1, true);


--
-- Name: chat_mensagens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_mensagens_id_seq', 2, true);


--
-- Name: compras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.compras_id_seq', 1, true);


--
-- Name: compras_itens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.compras_itens_id_seq', 3, true);


--
-- Name: config_ecommerce_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.config_ecommerce_pdv_id_seq', 2, true);


--
-- Name: config_entrega_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.config_entrega_pdv_id_seq', 7, true);


--
-- Name: configuracoes_plataforma_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.configuracoes_plataforma_id_seq', 1, true);


--
-- Name: corrida_mensagens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.corrida_mensagens_id_seq', 9, true);


--
-- Name: corridas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.corridas_id_seq', 19, true);


--
-- Name: corridas_solicitadas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.corridas_solicitadas_id_seq', 29, true);


--
-- Name: empresas_corporativas_pendentes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.empresas_corporativas_pendentes_id_seq', 2, true);


--
-- Name: empresas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.empresas_id_seq', 20, true);


--
-- Name: encomendas_clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.encomendas_clientes_id_seq', 4, true);


--
-- Name: encomendas_historico_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.encomendas_historico_id_seq', 3, true);


--
-- Name: encomendas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.encomendas_id_seq', 4, true);


--
-- Name: entregas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.entregas_id_seq', 2, true);


--
-- Name: entregas_solicitadas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.entregas_solicitadas_id_seq', 3, true);


--
-- Name: extras_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.extras_pdv_id_seq', 5, true);


--
-- Name: financeiro_lancamentos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.financeiro_lancamentos_id_seq', 2, true);


--
-- Name: fornecedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fornecedores_id_seq', 1, true);


--
-- Name: grupos_extras_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grupos_extras_pdv_id_seq', 1, false);


--
-- Name: itens_cardapio_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.itens_cardapio_id_seq', 1, false);


--
-- Name: itens_pedido_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.itens_pedido_id_seq', 1, false);


--
-- Name: itens_pedido_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.itens_pedido_pdv_id_seq', 16, true);


--
-- Name: modelos_veiculo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.modelos_veiculo_id_seq', 4, true);


--
-- Name: motivos_cancelamento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.motivos_cancelamento_id_seq', 7, true);


--
-- Name: motoristas_app_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.motoristas_app_id_seq', 5, true);


--
-- Name: motoristas_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.motoristas_pdv_id_seq', 5, true);


--
-- Name: opcoes_grupo_extras_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.opcoes_grupo_extras_pdv_id_seq', 1, false);


--
-- Name: pedidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pedidos_id_seq', 4, true);


--
-- Name: pedidos_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pedidos_pdv_id_seq', 11, true);


--
-- Name: pro_agendamentos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pro_agendamentos_id_seq', 6, true);


--
-- Name: pro_aprovacoes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pro_aprovacoes_id_seq', 1, false);


--
-- Name: pro_centros_custo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pro_centros_custo_id_seq', 1, false);


--
-- Name: pro_corridas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pro_corridas_id_seq', 1, false);


--
-- Name: pro_faturas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pro_faturas_id_seq', 1, false);


--
-- Name: pro_funcionarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pro_funcionarios_id_seq', 1, false);


--
-- Name: produtos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.produtos_id_seq', 9, true);


--
-- Name: produtos_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.produtos_pdv_id_seq', 36, true);


--
-- Name: promocoes_pdv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.promocoes_pdv_id_seq', 5, true);


--
-- Name: push_historico_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.push_historico_id_seq', 1, false);


--
-- Name: push_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.push_tokens_id_seq', 1, false);


--
-- Name: repasses_corporativos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repasses_corporativos_id_seq', 1, false);


--
-- Name: repasses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repasses_id_seq', 76, true);


--
-- Name: repasses_pro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repasses_pro_id_seq', 31, true);


--
-- Name: reservas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reservas_id_seq', 1, false);


--
-- Name: restaurantes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.restaurantes_id_seq', 8, true);


--
-- Name: rotas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rotas_id_seq', 1, false);


--
-- Name: servicos_catalogo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.servicos_catalogo_id_seq', 11, true);


--
-- Name: servicos_pacotes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.servicos_pacotes_id_seq', 1, false);


--
-- Name: servicos_prestadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.servicos_prestadores_id_seq', 4, true);


--
-- Name: servicos_promocoes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.servicos_promocoes_id_seq', 1, false);


--
-- Name: subcategorias_alimentacao_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subcategorias_alimentacao_id_seq', 14, true);


--
-- Name: suporte_mensagens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suporte_mensagens_id_seq', 7, true);


--
-- Name: suporte_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suporte_tickets_id_seq', 4, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 19, true);


--
-- Name: viagens_clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.viagens_clientes_id_seq', 4, true);


--
-- Name: viagens_horarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.viagens_horarios_id_seq', 12, true);


--
-- Name: viagens_passagens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.viagens_passagens_id_seq', 4, true);


--
-- Name: viagens_rotas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.viagens_rotas_id_seq', 7, true);


--
-- Name: afiliado_comissoes afiliado_comissoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_comissoes
    ADD CONSTRAINT afiliado_comissoes_pkey PRIMARY KEY (id);


--
-- Name: afiliado_indicacoes afiliado_indicacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_indicacoes
    ADD CONSTRAINT afiliado_indicacoes_pkey PRIMARY KEY (id);


--
-- Name: afiliado_resgates afiliado_resgates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_resgates
    ADD CONSTRAINT afiliado_resgates_pkey PRIMARY KEY (id);


--
-- Name: afiliados afiliados_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliados
    ADD CONSTRAINT afiliados_codigo_key UNIQUE (codigo);


--
-- Name: afiliados_config afiliados_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliados_config
    ADD CONSTRAINT afiliados_config_pkey PRIMARY KEY (id);


--
-- Name: afiliados afiliados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliados
    ADD CONSTRAINT afiliados_pkey PRIMARY KEY (id);


--
-- Name: afiliados afiliados_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliados
    ADD CONSTRAINT afiliados_usuario_id_key UNIQUE (usuario_id);


--
-- Name: agendamentos agendamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);


--
-- Name: carona_paradas carona_paradas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carona_paradas
    ADD CONSTRAINT carona_paradas_pkey PRIMARY KEY (id);


--
-- Name: carona_reservas carona_reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carona_reservas
    ADD CONSTRAINT carona_reservas_pkey PRIMARY KEY (id);


--
-- Name: carona_veiculos carona_veiculos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carona_veiculos
    ADD CONSTRAINT carona_veiculos_pkey PRIMARY KEY (id);


--
-- Name: caronas caronas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caronas
    ADD CONSTRAINT caronas_pkey PRIMARY KEY (id);


--
-- Name: categorias_corrida categorias_corrida_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_corrida
    ADD CONSTRAINT categorias_corrida_nome_key UNIQUE (nome);


--
-- Name: categorias_corrida categorias_corrida_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_corrida
    ADD CONSTRAINT categorias_corrida_pkey PRIMARY KEY (id);


--
-- Name: categorias_pdv categorias_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_pdv
    ADD CONSTRAINT categorias_pdv_pkey PRIMARY KEY (id);


--
-- Name: categorias_servicos categorias_servicos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_servicos
    ADD CONSTRAINT categorias_servicos_pkey PRIMARY KEY (id);


--
-- Name: chat_conversas chat_conversas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_conversas
    ADD CONSTRAINT chat_conversas_pkey PRIMARY KEY (id);


--
-- Name: chat_mensagens chat_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensagens
    ADD CONSTRAINT chat_mensagens_pkey PRIMARY KEY (id);


--
-- Name: compras_itens compras_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras_itens
    ADD CONSTRAINT compras_itens_pkey PRIMARY KEY (id);


--
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- Name: config_ecommerce_pdv config_ecommerce_pdv_empresa_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_ecommerce_pdv
    ADD CONSTRAINT config_ecommerce_pdv_empresa_id_key UNIQUE (empresa_id);


--
-- Name: config_ecommerce_pdv config_ecommerce_pdv_empresa_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_ecommerce_pdv
    ADD CONSTRAINT config_ecommerce_pdv_empresa_id_unique UNIQUE (empresa_id);


--
-- Name: config_ecommerce_pdv config_ecommerce_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_ecommerce_pdv
    ADD CONSTRAINT config_ecommerce_pdv_pkey PRIMARY KEY (id);


--
-- Name: config_entrega_pdv config_entrega_pdv_empresa_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_entrega_pdv
    ADD CONSTRAINT config_entrega_pdv_empresa_id_key UNIQUE (empresa_id);


--
-- Name: config_entrega_pdv config_entrega_pdv_empresa_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_entrega_pdv
    ADD CONSTRAINT config_entrega_pdv_empresa_id_unique UNIQUE (empresa_id);


--
-- Name: config_entrega_pdv config_entrega_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_entrega_pdv
    ADD CONSTRAINT config_entrega_pdv_pkey PRIMARY KEY (id);


--
-- Name: config_pagamento_pdv config_pagamento_pdv_empresa_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_pagamento_pdv
    ADD CONSTRAINT config_pagamento_pdv_empresa_id_unique UNIQUE (empresa_id);


--
-- Name: config_pagamento_pdv config_pagamento_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_pagamento_pdv
    ADD CONSTRAINT config_pagamento_pdv_pkey PRIMARY KEY (empresa_id);


--
-- Name: configuracoes_plataforma configuracoes_plataforma_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracoes_plataforma
    ADD CONSTRAINT configuracoes_plataforma_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_sistema configuracoes_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracoes_sistema
    ADD CONSTRAINT configuracoes_sistema_pkey PRIMARY KEY (chave);


--
-- Name: corrida_mensagens corrida_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corrida_mensagens
    ADD CONSTRAINT corrida_mensagens_pkey PRIMARY KEY (id);


--
-- Name: corridas corridas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corridas
    ADD CONSTRAINT corridas_pkey PRIMARY KEY (id);


--
-- Name: corridas_solicitadas corridas_solicitadas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corridas_solicitadas
    ADD CONSTRAINT corridas_solicitadas_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_codigo_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_codigo_unique UNIQUE (codigo);


--
-- Name: empresas_corporativas_pendentes empresas_corporativas_pendentes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas_corporativas_pendentes
    ADD CONSTRAINT empresas_corporativas_pendentes_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: encomendas_clientes encomendas_clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encomendas_clientes
    ADD CONSTRAINT encomendas_clientes_pkey PRIMARY KEY (id);


--
-- Name: encomendas encomendas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encomendas
    ADD CONSTRAINT encomendas_codigo_key UNIQUE (codigo);


--
-- Name: encomendas_historico encomendas_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encomendas_historico
    ADD CONSTRAINT encomendas_historico_pkey PRIMARY KEY (id);


--
-- Name: encomendas encomendas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encomendas
    ADD CONSTRAINT encomendas_pkey PRIMARY KEY (id);


--
-- Name: entregas entregas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entregas
    ADD CONSTRAINT entregas_pkey PRIMARY KEY (id);


--
-- Name: entregas_solicitadas entregas_solicitadas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entregas_solicitadas
    ADD CONSTRAINT entregas_solicitadas_pkey PRIMARY KEY (id);


--
-- Name: extras_pdv extras_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extras_pdv
    ADD CONSTRAINT extras_pdv_pkey PRIMARY KEY (id);


--
-- Name: financeiro_lancamentos financeiro_lancamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_pkey PRIMARY KEY (id);


--
-- Name: fornecedores fornecedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fornecedores
    ADD CONSTRAINT fornecedores_pkey PRIMARY KEY (id);


--
-- Name: gotatxi_config gotatxi_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gotatxi_config
    ADD CONSTRAINT gotatxi_config_pkey PRIMARY KEY (chave);


--
-- Name: grupos_extras_pdv grupos_extras_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos_extras_pdv
    ADD CONSTRAINT grupos_extras_pdv_pkey PRIMARY KEY (id);


--
-- Name: itens_cardapio itens_cardapio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_cardapio
    ADD CONSTRAINT itens_cardapio_pkey PRIMARY KEY (id);


--
-- Name: itens_pedido_pdv itens_pedido_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_pedido_pdv
    ADD CONSTRAINT itens_pedido_pdv_pkey PRIMARY KEY (id);


--
-- Name: itens_pedido itens_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_pedido
    ADD CONSTRAINT itens_pedido_pkey PRIMARY KEY (id);


--
-- Name: modelo_categorias modelo_categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modelo_categorias
    ADD CONSTRAINT modelo_categorias_pkey PRIMARY KEY (modelo_id, categoria_id);


--
-- Name: modelos_veiculo modelos_veiculo_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modelos_veiculo
    ADD CONSTRAINT modelos_veiculo_nome_key UNIQUE (nome);


--
-- Name: modelos_veiculo modelos_veiculo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modelos_veiculo
    ADD CONSTRAINT modelos_veiculo_pkey PRIMARY KEY (id);


--
-- Name: motivos_cancelamento motivos_cancelamento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.motivos_cancelamento
    ADD CONSTRAINT motivos_cancelamento_pkey PRIMARY KEY (id);


--
-- Name: motorista_categorias motorista_categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.motorista_categorias
    ADD CONSTRAINT motorista_categorias_pkey PRIMARY KEY (motorista_id, categoria_id);


--
-- Name: motoristas_app motoristas_app_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.motoristas_app
    ADD CONSTRAINT motoristas_app_pkey PRIMARY KEY (id);


--
-- Name: motoristas_pdv motoristas_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.motoristas_pdv
    ADD CONSTRAINT motoristas_pdv_pkey PRIMARY KEY (id);


--
-- Name: opcoes_grupo_extras_pdv opcoes_grupo_extras_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opcoes_grupo_extras_pdv
    ADD CONSTRAINT opcoes_grupo_extras_pdv_pkey PRIMARY KEY (id);


--
-- Name: pedidos_pdv pedidos_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos_pdv
    ADD CONSTRAINT pedidos_pdv_pkey PRIMARY KEY (id);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: pro_agendamentos pro_agendamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_agendamentos
    ADD CONSTRAINT pro_agendamentos_pkey PRIMARY KEY (id);


--
-- Name: pro_aprovacoes pro_aprovacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_aprovacoes
    ADD CONSTRAINT pro_aprovacoes_pkey PRIMARY KEY (id);


--
-- Name: pro_centros_custo pro_centros_custo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_centros_custo
    ADD CONSTRAINT pro_centros_custo_pkey PRIMARY KEY (id);


--
-- Name: pro_corridas pro_corridas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_corridas
    ADD CONSTRAINT pro_corridas_pkey PRIMARY KEY (id);


--
-- Name: pro_faturas pro_faturas_empresa_id_mes_referencia_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_faturas
    ADD CONSTRAINT pro_faturas_empresa_id_mes_referencia_key UNIQUE (empresa_id, mes_referencia);


--
-- Name: pro_faturas pro_faturas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_faturas
    ADD CONSTRAINT pro_faturas_pkey PRIMARY KEY (id);


--
-- Name: pro_funcionarios pro_funcionarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_funcionarios
    ADD CONSTRAINT pro_funcionarios_pkey PRIMARY KEY (id);


--
-- Name: produto_extras_pdv produto_extras_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_extras_pdv
    ADD CONSTRAINT produto_extras_pdv_pkey PRIMARY KEY (produto_id, extra_id);


--
-- Name: produto_grupos_extras_pdv produto_grupos_extras_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_grupos_extras_pdv
    ADD CONSTRAINT produto_grupos_extras_pdv_pkey PRIMARY KEY (produto_id, grupo_id);


--
-- Name: produtos_pdv produtos_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos_pdv
    ADD CONSTRAINT produtos_pdv_pkey PRIMARY KEY (id);


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);


--
-- Name: promocoes_pdv promocoes_pdv_empresa_id_codigo_cupom_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promocoes_pdv
    ADD CONSTRAINT promocoes_pdv_empresa_id_codigo_cupom_key UNIQUE (empresa_id, codigo_cupom);


--
-- Name: promocoes_pdv promocoes_pdv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promocoes_pdv
    ADD CONSTRAINT promocoes_pdv_pkey PRIMARY KEY (id);


--
-- Name: push_historico push_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_historico
    ADD CONSTRAINT push_historico_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: repasses_corporativos repasses_corporativos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses_corporativos
    ADD CONSTRAINT repasses_corporativos_pkey PRIMARY KEY (id);


--
-- Name: repasses repasses_empresa_id_semana_inicio_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses
    ADD CONSTRAINT repasses_empresa_id_semana_inicio_key UNIQUE (empresa_id, semana_inicio);


--
-- Name: repasses repasses_empresa_semana_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses
    ADD CONSTRAINT repasses_empresa_semana_unique UNIQUE (empresa_id, semana_inicio);


--
-- Name: repasses repasses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses
    ADD CONSTRAINT repasses_pkey PRIMARY KEY (id);


--
-- Name: repasses_pro repasses_pro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses_pro
    ADD CONSTRAINT repasses_pro_pkey PRIMARY KEY (id);


--
-- Name: repasses_pro repasses_pro_profissional_id_semana_inicio_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses_pro
    ADD CONSTRAINT repasses_pro_profissional_id_semana_inicio_key UNIQUE (profissional_id, semana_inicio);


--
-- Name: reservas reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_pkey PRIMARY KEY (id);


--
-- Name: restaurantes restaurantes_empresa_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurantes
    ADD CONSTRAINT restaurantes_empresa_id_unique UNIQUE (empresa_id);


--
-- Name: restaurantes restaurantes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurantes
    ADD CONSTRAINT restaurantes_pkey PRIMARY KEY (id);


--
-- Name: rotas rotas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotas
    ADD CONSTRAINT rotas_pkey PRIMARY KEY (id);


--
-- Name: servicos_catalogo servicos_catalogo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_catalogo
    ADD CONSTRAINT servicos_catalogo_pkey PRIMARY KEY (id);


--
-- Name: servicos_pacotes servicos_pacotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_pacotes
    ADD CONSTRAINT servicos_pacotes_pkey PRIMARY KEY (id);


--
-- Name: servicos_prestadores servicos_prestadores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_prestadores
    ADD CONSTRAINT servicos_prestadores_pkey PRIMARY KEY (id);


--
-- Name: servicos_promocoes servicos_promocoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_promocoes
    ADD CONSTRAINT servicos_promocoes_pkey PRIMARY KEY (id);


--
-- Name: subcategorias_alimentacao subcategorias_alimentacao_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategorias_alimentacao
    ADD CONSTRAINT subcategorias_alimentacao_nome_key UNIQUE (nome);


--
-- Name: subcategorias_alimentacao subcategorias_alimentacao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategorias_alimentacao
    ADD CONSTRAINT subcategorias_alimentacao_pkey PRIMARY KEY (id);


--
-- Name: subcategorias_alimentacao subcategorias_alimentacao_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategorias_alimentacao
    ADD CONSTRAINT subcategorias_alimentacao_slug_key UNIQUE (slug);


--
-- Name: suporte_mensagens suporte_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suporte_mensagens
    ADD CONSTRAINT suporte_mensagens_pkey PRIMARY KEY (id);


--
-- Name: suporte_tickets suporte_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suporte_tickets
    ADD CONSTRAINT suporte_tickets_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_unique UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: viagens_clientes viagens_clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_clientes
    ADD CONSTRAINT viagens_clientes_pkey PRIMARY KEY (id);


--
-- Name: viagens_horarios viagens_horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_horarios
    ADD CONSTRAINT viagens_horarios_pkey PRIMARY KEY (id);


--
-- Name: viagens_passagens viagens_passagens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_passagens
    ADD CONSTRAINT viagens_passagens_pkey PRIMARY KEY (id);


--
-- Name: viagens_rotas viagens_rotas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_rotas
    ADD CONSTRAINT viagens_rotas_pkey PRIMARY KEY (id);


--
-- Name: idx_chat_conversas_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_conversas_empresa ON public.chat_conversas USING btree (empresa_id);


--
-- Name: idx_chat_conversas_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_conversas_token ON public.chat_conversas USING btree (cliente_token);


--
-- Name: idx_chat_mensagens_conversa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_mensagens_conversa ON public.chat_mensagens USING btree (conversa_id, created_at);


--
-- Name: idx_compras_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compras_empresa ON public.compras USING btree (empresa_id, data_compra);


--
-- Name: idx_empresas_corp_pendentes_afiliado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_empresas_corp_pendentes_afiliado ON public.empresas_corporativas_pendentes USING btree (afiliado_id);


--
-- Name: idx_empresas_corp_pendentes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_empresas_corp_pendentes_status ON public.empresas_corporativas_pendentes USING btree (status);


--
-- Name: idx_entregas_solic_pedido_pdv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entregas_solic_pedido_pdv ON public.entregas_solicitadas USING btree (pedido_pdv_id) WHERE (pedido_pdv_id IS NOT NULL);


--
-- Name: idx_fin_lanc_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fin_lanc_empresa ON public.financeiro_lancamentos USING btree (empresa_id, data);


--
-- Name: idx_fornecedores_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fornecedores_empresa ON public.fornecedores USING btree (empresa_id);


--
-- Name: idx_repasses_corp_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repasses_corp_status ON public.repasses_corporativos USING btree (status);


--
-- Name: idx_suporte_mens_ticket; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suporte_mens_ticket ON public.suporte_mensagens USING btree (ticket_id, created_at);


--
-- Name: idx_suporte_tickets_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suporte_tickets_empresa ON public.suporte_tickets USING btree (empresa_id);


--
-- Name: idx_suporte_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suporte_tickets_status ON public.suporte_tickets USING btree (status, ultima_at);


--
-- Name: push_tokens_token_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX push_tokens_token_idx ON public.push_tokens USING btree (token);


--
-- Name: uq_repasses_corp_empresa_semana; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_repasses_corp_empresa_semana ON public.repasses_corporativos USING btree (empresa_id, semana_inicio);


--
-- Name: afiliado_comissoes afiliado_comissoes_afiliado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_comissoes
    ADD CONSTRAINT afiliado_comissoes_afiliado_id_fkey FOREIGN KEY (afiliado_id) REFERENCES public.afiliados(id);


--
-- Name: afiliado_comissoes afiliado_comissoes_indicado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_comissoes
    ADD CONSTRAINT afiliado_comissoes_indicado_id_fkey FOREIGN KEY (indicado_id) REFERENCES public.afiliado_indicacoes(id);


--
-- Name: afiliado_indicacoes afiliado_indicacoes_afiliado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_indicacoes
    ADD CONSTRAINT afiliado_indicacoes_afiliado_id_fkey FOREIGN KEY (afiliado_id) REFERENCES public.afiliados(id);


--
-- Name: afiliado_resgates afiliado_resgates_afiliado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afiliado_resgates
    ADD CONSTRAINT afiliado_resgates_afiliado_id_fkey FOREIGN KEY (afiliado_id) REFERENCES public.afiliados(id);


--
-- Name: agendamentos agendamentos_catalogo_id_servicos_catalogo_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_catalogo_id_servicos_catalogo_id_fk FOREIGN KEY (catalogo_id) REFERENCES public.servicos_catalogo(id);


--
-- Name: agendamentos agendamentos_categoria_id_categorias_servicos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_categoria_id_categorias_servicos_id_fk FOREIGN KEY (categoria_id) REFERENCES public.categorias_servicos(id);


--
-- Name: agendamentos agendamentos_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: agendamentos agendamentos_prestador_id_servicos_prestadores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_prestador_id_servicos_prestadores_id_fk FOREIGN KEY (prestador_id) REFERENCES public.servicos_prestadores(id);


--
-- Name: categorias_pdv categorias_pdv_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_pdv
    ADD CONSTRAINT categorias_pdv_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: categorias_servicos categorias_servicos_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_servicos
    ADD CONSTRAINT categorias_servicos_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: chat_mensagens chat_mensagens_conversa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensagens
    ADD CONSTRAINT chat_mensagens_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES public.chat_conversas(id) ON DELETE CASCADE;


--
-- Name: compras compras_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE SET NULL;


--
-- Name: compras_itens compras_itens_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras_itens
    ADD CONSTRAINT compras_itens_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;


--
-- Name: config_ecommerce_pdv config_ecommerce_pdv_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_ecommerce_pdv
    ADD CONSTRAINT config_ecommerce_pdv_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: config_entrega_pdv config_entrega_pdv_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_entrega_pdv
    ADD CONSTRAINT config_entrega_pdv_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: corridas corridas_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corridas
    ADD CONSTRAINT corridas_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: encomendas_historico encomendas_historico_encomenda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encomendas_historico
    ADD CONSTRAINT encomendas_historico_encomenda_id_fkey FOREIGN KEY (encomenda_id) REFERENCES public.encomendas(id) ON DELETE CASCADE;


--
-- Name: entregas entregas_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entregas
    ADD CONSTRAINT entregas_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: extras_pdv extras_pdv_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extras_pdv
    ADD CONSTRAINT extras_pdv_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: itens_cardapio itens_cardapio_restaurante_id_restaurantes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_cardapio
    ADD CONSTRAINT itens_cardapio_restaurante_id_restaurantes_id_fk FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id);


--
-- Name: itens_pedido_pdv itens_pedido_pdv_pedido_id_pedidos_pdv_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_pedido_pdv
    ADD CONSTRAINT itens_pedido_pdv_pedido_id_pedidos_pdv_id_fk FOREIGN KEY (pedido_id) REFERENCES public.pedidos_pdv(id);


--
-- Name: itens_pedido itens_pedido_pedido_id_pedidos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.itens_pedido
    ADD CONSTRAINT itens_pedido_pedido_id_pedidos_id_fk FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);


--
-- Name: motoristas_pdv motoristas_pdv_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.motoristas_pdv
    ADD CONSTRAINT motoristas_pdv_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: opcoes_grupo_extras_pdv opcoes_grupo_extras_pdv_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opcoes_grupo_extras_pdv
    ADD CONSTRAINT opcoes_grupo_extras_pdv_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_extras_pdv(id) ON DELETE CASCADE;


--
-- Name: pedidos pedidos_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: pedidos_pdv pedidos_pdv_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos_pdv
    ADD CONSTRAINT pedidos_pdv_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: pro_agendamentos pro_agendamentos_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_agendamentos
    ADD CONSTRAINT pro_agendamentos_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.motoristas_app(id);


--
-- Name: pro_aprovacoes pro_aprovacoes_corrida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_aprovacoes
    ADD CONSTRAINT pro_aprovacoes_corrida_id_fkey FOREIGN KEY (corrida_id) REFERENCES public.pro_corridas(id) ON DELETE CASCADE;


--
-- Name: pro_centros_custo pro_centros_custo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_centros_custo
    ADD CONSTRAINT pro_centros_custo_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: pro_corridas pro_corridas_centro_custo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_corridas
    ADD CONSTRAINT pro_corridas_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES public.pro_centros_custo(id);


--
-- Name: pro_corridas pro_corridas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_corridas
    ADD CONSTRAINT pro_corridas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: pro_corridas pro_corridas_funcionario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_corridas
    ADD CONSTRAINT pro_corridas_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES public.pro_funcionarios(id);


--
-- Name: pro_faturas pro_faturas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_faturas
    ADD CONSTRAINT pro_faturas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: pro_funcionarios pro_funcionarios_centro_custo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_funcionarios
    ADD CONSTRAINT pro_funcionarios_centro_custo_id_fkey FOREIGN KEY (centro_custo_id) REFERENCES public.pro_centros_custo(id);


--
-- Name: pro_funcionarios pro_funcionarios_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pro_funcionarios
    ADD CONSTRAINT pro_funcionarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: produto_extras_pdv produto_extras_pdv_extra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_extras_pdv
    ADD CONSTRAINT produto_extras_pdv_extra_id_fkey FOREIGN KEY (extra_id) REFERENCES public.extras_pdv(id) ON DELETE CASCADE;


--
-- Name: produto_extras_pdv produto_extras_pdv_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_extras_pdv
    ADD CONSTRAINT produto_extras_pdv_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos_pdv(id) ON DELETE CASCADE;


--
-- Name: produto_grupos_extras_pdv produto_grupos_extras_pdv_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_grupos_extras_pdv
    ADD CONSTRAINT produto_grupos_extras_pdv_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_extras_pdv(id) ON DELETE CASCADE;


--
-- Name: produtos produtos_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: produtos_pdv produtos_pdv_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos_pdv
    ADD CONSTRAINT produtos_pdv_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_pdv(id);


--
-- Name: produtos_pdv produtos_pdv_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos_pdv
    ADD CONSTRAINT produtos_pdv_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: promocoes_pdv promocoes_pdv_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promocoes_pdv
    ADD CONSTRAINT promocoes_pdv_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: promocoes_pdv promocoes_pdv_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promocoes_pdv
    ADD CONSTRAINT promocoes_pdv_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos_pdv(id) ON DELETE SET NULL;


--
-- Name: push_tokens push_tokens_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: repasses repasses_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repasses
    ADD CONSTRAINT repasses_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: reservas reservas_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: reservas reservas_rota_id_rotas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_rota_id_rotas_id_fk FOREIGN KEY (rota_id) REFERENCES public.rotas(id);


--
-- Name: restaurantes restaurantes_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurantes
    ADD CONSTRAINT restaurantes_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: restaurantes restaurantes_subcategoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurantes
    ADD CONSTRAINT restaurantes_subcategoria_id_fkey FOREIGN KEY (subcategoria_id) REFERENCES public.subcategorias_alimentacao(id) ON DELETE SET NULL;


--
-- Name: rotas rotas_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotas
    ADD CONSTRAINT rotas_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: servicos_catalogo servicos_catalogo_categoria_id_categorias_servicos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_catalogo
    ADD CONSTRAINT servicos_catalogo_categoria_id_categorias_servicos_id_fk FOREIGN KEY (categoria_id) REFERENCES public.categorias_servicos(id);


--
-- Name: servicos_catalogo servicos_catalogo_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_catalogo
    ADD CONSTRAINT servicos_catalogo_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: servicos_catalogo servicos_catalogo_prestador_id_servicos_prestadores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_catalogo
    ADD CONSTRAINT servicos_catalogo_prestador_id_servicos_prestadores_id_fk FOREIGN KEY (prestador_id) REFERENCES public.servicos_prestadores(id);


--
-- Name: servicos_prestadores servicos_prestadores_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicos_prestadores
    ADD CONSTRAINT servicos_prestadores_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: suporte_mensagens suporte_mensagens_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suporte_mensagens
    ADD CONSTRAINT suporte_mensagens_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.suporte_tickets(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_empresa_id_empresas_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_empresa_id_empresas_id_fk FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: viagens_clientes viagens_clientes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_clientes
    ADD CONSTRAINT viagens_clientes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: viagens_horarios viagens_horarios_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_horarios
    ADD CONSTRAINT viagens_horarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: viagens_horarios viagens_horarios_rota_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_horarios
    ADD CONSTRAINT viagens_horarios_rota_id_fkey FOREIGN KEY (rota_id) REFERENCES public.viagens_rotas(id) ON DELETE CASCADE;


--
-- Name: viagens_passagens viagens_passagens_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_passagens
    ADD CONSTRAINT viagens_passagens_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.viagens_clientes(id);


--
-- Name: viagens_passagens viagens_passagens_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_passagens
    ADD CONSTRAINT viagens_passagens_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: viagens_passagens viagens_passagens_horario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_passagens
    ADD CONSTRAINT viagens_passagens_horario_id_fkey FOREIGN KEY (horario_id) REFERENCES public.viagens_horarios(id);


--
-- Name: viagens_rotas viagens_rotas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viagens_rotas
    ADD CONSTRAINT viagens_rotas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict P1mcDNXZY2XsVWvLP8MQ9f9cLgj2BYCrB3k4Iwboufr8fZwW5CJFhIyk8SPIfvZ

