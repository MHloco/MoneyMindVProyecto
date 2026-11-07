--
-- PostgreSQL database dump
--

\restrict db6RisdaOgXE9d57g6i7QFM1b90EvNTNBJf3h7NTGMihoCDDXndGeSdrkPSogJG

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: agent_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agent_type AS ENUM (
    'ANALYST',
    'BUDGET',
    'PROJECTION',
    'ANOMALY',
    'ADVISOR'
);


--
-- Name: alert_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_severity AS ENUM (
    'INFO',
    'WARNING',
    'CRITICAL'
);


--
-- Name: alert_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_status AS ENUM (
    'PENDING',
    'SENT',
    'READ',
    'DISMISSED'
);


--
-- Name: alert_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_type AS ENUM (
    'OBLIGATION_DUE',
    'BUDGET_THRESHOLD',
    'BUDGET_EXCEEDED',
    'UNUSUAL_SPENDING',
    'LOW_PROJECTED_BALANCE',
    'RECURRING_GENERATED',
    'AI_INSIGHT'
);


--
-- Name: budget_period; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.budget_period AS ENUM (
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'ANNUAL',
    'CUSTOM'
);


--
-- Name: insight_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insight_status AS ENUM (
    'NEW',
    'READ',
    'DISMISSED',
    'APPLIED'
);


--
-- Name: insight_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insight_type AS ENUM (
    'ANOMALY',
    'RECOMMENDATION',
    'PROJECTION',
    'SUMMARY',
    'RISK'
);


--
-- Name: installment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.installment_status AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID',
    'OVERDUE'
);


--
-- Name: message_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_role AS ENUM (
    'USER',
    'ASSISTANT',
    'SYSTEM',
    'TOOL'
);


--
-- Name: obligation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.obligation_status AS ENUM (
    'ACTIVE',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


--
-- Name: obligation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.obligation_type AS ENUM (
    'LOAN',
    'CREDIT_CARD',
    'INSTALLMENT',
    'SUBSCRIPTION',
    'TAX',
    'RENT',
    'OTHER'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'CASH',
    'DEBIT_CARD',
    'CREDIT_CARD',
    'TRANSFER',
    'WALLET',
    'OTHER'
);


--
-- Name: recurrence_freq; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recurrence_freq AS ENUM (
    'DAILY',
    'WEEKLY',
    'BIWEEKLY',
    'MONTHLY',
    'BIMONTHLY',
    'QUARTERLY',
    'SEMIANNUAL',
    'ANNUAL'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'ACTIVE',
    'TRIALING',
    'PAST_DUE',
    'CANCELLED',
    'EXPIRED'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'INCOME',
    'EXPENSE'
);


--
-- Name: fn_available_balance(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_available_balance(p_user_id uuid, p_from date, p_to date) RETURNS TABLE(real_income numeric, real_expense numeric, current_balance numeric, pending_committed numeric, available_to_spend numeric)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    WITH real_tx AS (
        SELECT
            COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0)  AS inc,
            COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0) AS exp
        FROM transactions
        WHERE user_id = p_user_id
          AND deleted_at IS NULL
          AND transaction_date BETWEEN p_from AND p_to
    ),
    committed AS (
        SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) AS pending
        FROM obligation_installments i
        JOIN obligations o ON o.id = i.obligation_id
        WHERE o.user_id = p_user_id
          AND o.status = 'ACTIVE'
          AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
          AND i.due_date BETWEEN CURRENT_DATE AND p_to
    ),
    recurring AS (
        SELECT COALESCE(SUM(amount), 0) AS pending
        FROM recurring_transactions
        WHERE user_id = p_user_id
          AND is_active
          AND type = 'EXPENSE'
          AND next_occurrence_date BETWEEN CURRENT_DATE AND p_to
    )
    SELECT
        r.inc,
        r.exp,
        r.inc - r.exp,
        c.pending + rc.pending,
        (r.inc - r.exp) - (c.pending + rc.pending)
    FROM real_tx r, committed c, recurring rc;
END;
$$;


--
-- Name: fn_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: fn_sync_obligation_totals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_obligation_totals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_obligation_id UUID := COALESCE(NEW.obligation_id, OLD.obligation_id);
    v_paid  NUMERIC(14,2);
    v_total NUMERIC(14,2);
BEGIN
    SELECT COALESCE(SUM(paid_amount), 0) INTO v_paid
    FROM obligation_installments WHERE obligation_id = v_obligation_id;

    SELECT total_amount INTO v_total FROM obligations WHERE id = v_obligation_id;

    UPDATE obligations
       SET paid_amount = LEAST(v_paid, v_total),
           status      = CASE WHEN v_paid >= v_total THEN 'PAID'::obligation_status
                              ELSE status END
     WHERE id = v_obligation_id;

    RETURN NULL;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(160) DEFAULT 'Nueva conversación'::character varying NOT NULL,
    agent public.agent_type DEFAULT 'ADVISOR'::public.agent_type NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    agent public.agent_type NOT NULL,
    type public.insight_type NOT NULL,
    status public.insight_status DEFAULT 'NEW'::public.insight_status NOT NULL,
    severity public.alert_severity DEFAULT 'INFO'::public.alert_severity NOT NULL,
    title character varying(160) NOT NULL,
    content text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    confidence numeric(3,2),
    period_start date,
    period_end date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_insights_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))
);


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role public.message_role NOT NULL,
    content text NOT NULL,
    tool_calls jsonb DEFAULT '[]'::jsonb NOT NULL,
    model character varying(60),
    tokens_input integer,
    tokens_output integer,
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period_month date NOT NULL,
    queries_count integer DEFAULT 0 NOT NULL,
    tokens_total bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alert_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.alert_type NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    days_before smallint DEFAULT 3 NOT NULL,
    threshold numeric(3,2),
    channels jsonb DEFAULT '["IN_APP"]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alert_preferences_days_before_check CHECK ((days_before >= 0)),
    CONSTRAINT alert_preferences_threshold_check CHECK (((threshold > (0)::numeric) AND (threshold <= (1)::numeric)))
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.alert_type NOT NULL,
    severity public.alert_severity DEFAULT 'INFO'::public.alert_severity NOT NULL,
    status public.alert_status DEFAULT 'PENDING'::public.alert_status NOT NULL,
    title character varying(140) NOT NULL,
    message text NOT NULL,
    related_entity_type character varying(30),
    related_entity_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid,
    name character varying(100) NOT NULL,
    amount numeric(14,2) NOT NULL,
    currency character(3) DEFAULT 'PEN'::bpchar NOT NULL,
    period_type public.budget_period DEFAULT 'MONTHLY'::public.budget_period NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    alert_threshold numeric(3,2) DEFAULT 0.80 NOT NULL,
    rollover boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT budgets_alert_threshold_check CHECK (((alert_threshold > (0)::numeric) AND (alert_threshold <= (1)::numeric))),
    CONSTRAINT budgets_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT budgets_check CHECK ((period_end >= period_start))
);


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(140) NOT NULL,
    description text,
    event_date date NOT NULL,
    color character varying(20) DEFAULT '#3b82f6'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    parent_id uuid,
    name character varying(60) NOT NULL,
    type public.transaction_type NOT NULL,
    color character varying(9) DEFAULT '#607D8B'::character varying NOT NULL,
    icon character varying(40) DEFAULT 'category'::character varying NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT categories_check CHECK (((parent_id IS NULL) OR (parent_id <> id)))
);


--
-- Name: obligation_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.obligation_installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    obligation_id uuid NOT NULL,
    transaction_id uuid,
    number smallint NOT NULL,
    due_date date NOT NULL,
    amount numeric(14,2) NOT NULL,
    paid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    status public.installment_status DEFAULT 'PENDING'::public.installment_status NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT obligation_installments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT obligation_installments_number_check CHECK ((number > 0)),
    CONSTRAINT obligation_installments_paid_amount_check CHECK ((paid_amount >= (0)::numeric))
);


--
-- Name: obligations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.obligations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid,
    name character varying(120) NOT NULL,
    type public.obligation_type DEFAULT 'OTHER'::public.obligation_type NOT NULL,
    creditor character varying(120),
    total_amount numeric(14,2) NOT NULL,
    paid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'PEN'::bpchar NOT NULL,
    installments_count smallint DEFAULT 1 NOT NULL,
    interest_rate numeric(6,3),
    start_date date NOT NULL,
    due_day smallint,
    status public.obligation_status DEFAULT 'ACTIVE'::public.obligation_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT obligations_check CHECK ((paid_amount <= total_amount)),
    CONSTRAINT obligations_due_day_check CHECK (((due_day >= 1) AND (due_day <= 31))),
    CONSTRAINT obligations_installments_count_check CHECK ((installments_count > 0)),
    CONSTRAINT obligations_interest_rate_check CHECK ((interest_rate >= (0)::numeric)),
    CONSTRAINT obligations_paid_amount_check CHECK ((paid_amount >= (0)::numeric)),
    CONSTRAINT obligations_total_amount_check CHECK ((total_amount > (0)::numeric))
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(80) NOT NULL,
    description text,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'PEN'::bpchar NOT NULL,
    billing_period character varying(20) DEFAULT 'MONTHLY'::character varying NOT NULL,
    max_budgets integer DEFAULT 3 NOT NULL,
    max_obligations integer DEFAULT 5 NOT NULL,
    max_ai_queries integer DEFAULT 20 NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plans_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: projection_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projection_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    opening_balance numeric(14,2) DEFAULT 0 NOT NULL,
    projected_income numeric(14,2) DEFAULT 0 NOT NULL,
    projected_expense numeric(14,2) DEFAULT 0 NOT NULL,
    committed_amount numeric(14,2) DEFAULT 0 NOT NULL,
    projected_balance numeric(14,2) DEFAULT 0 NOT NULL,
    available_to_spend numeric(14,2) DEFAULT 0 NOT NULL,
    breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_by character varying(30) DEFAULT 'SYSTEM'::character varying NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT projection_snapshots_check CHECK ((period_end >= period_start))
);


--
-- Name: recurring_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid,
    type public.transaction_type NOT NULL,
    description character varying(160) NOT NULL,
    amount numeric(14,2) NOT NULL,
    currency character(3) DEFAULT 'PEN'::bpchar NOT NULL,
    payment_method public.payment_method,
    frequency public.recurrence_freq DEFAULT 'MONTHLY'::public.recurrence_freq NOT NULL,
    interval_count smallint DEFAULT 1 NOT NULL,
    day_of_month smallint,
    weekday smallint,
    start_date date NOT NULL,
    end_date date,
    next_occurrence_date date NOT NULL,
    last_generated_date date,
    auto_generate boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recurring_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT recurring_transactions_check CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT recurring_transactions_day_of_month_check CHECK (((day_of_month >= 1) AND (day_of_month <= 31))),
    CONSTRAINT recurring_transactions_interval_count_check CHECK ((interval_count > 0)),
    CONSTRAINT recurring_transactions_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status public.subscription_status DEFAULT 'ACTIVE'::public.subscription_status NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    current_period_start date NOT NULL,
    current_period_end date NOT NULL,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_check CHECK ((current_period_end > current_period_start))
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid,
    recurring_id uuid,
    type public.transaction_type NOT NULL,
    amount numeric(14,2) NOT NULL,
    currency character(3) DEFAULT 'PEN'::bpchar NOT NULL,
    description character varying(160) NOT NULL,
    notes text,
    transaction_date date NOT NULL,
    payment_method public.payment_method DEFAULT 'CASH'::public.payment_method NOT NULL,
    source character varying(80),
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT transactions_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email public.citext NOT NULL,
    password_hash text NOT NULL,
    full_name character varying(120) NOT NULL,
    currency character(3) DEFAULT 'PEN'::bpchar NOT NULL,
    timezone character varying(60) DEFAULT 'America/Lima'::character varying NOT NULL,
    locale character varying(10) DEFAULT 'es-PE'::character varying NOT NULL,
    period_start_day smallint DEFAULT 1 NOT NULL,
    email_verified_at timestamp with time zone,
    last_login_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    role character varying(20) DEFAULT 'USER'::character varying NOT NULL,
    CONSTRAINT users_period_start_day_check CHECK (((period_start_day >= 1) AND (period_start_day <= 28))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['USER'::character varying, 'SUPERUSER'::character varying])::text[])))
);


--
-- Name: v_budget_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_budget_status AS
SELECT
    NULL::uuid AS budget_id,
    NULL::uuid AS user_id,
    NULL::character varying(100) AS name,
    NULL::uuid AS category_id,
    NULL::character varying(60) AS category_name,
    NULL::numeric(14,2) AS budget_amount,
    NULL::date AS period_start,
    NULL::date AS period_end,
    NULL::numeric(3,2) AS alert_threshold,
    NULL::numeric AS spent_amount,
    NULL::numeric AS remaining_amount,
    NULL::numeric AS consumed_ratio;


--
-- Name: v_expense_distribution; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_expense_distribution AS
 SELECT t.user_id,
    (date_trunc('month'::text, (t.transaction_date)::timestamp with time zone))::date AS month,
    t.category_id,
    COALESCE(c.name, 'Sin categoría'::character varying) AS category_name,
    COALESCE(c.color, '#9E9E9E'::character varying) AS category_color,
    sum(t.amount) AS total,
    count(*) AS movements
   FROM (public.transactions t
     LEFT JOIN public.categories c ON ((c.id = t.category_id)))
  WHERE ((t.type = 'EXPENSE'::public.transaction_type) AND (t.deleted_at IS NULL))
  GROUP BY t.user_id, (date_trunc('month'::text, (t.transaction_date)::timestamp with time zone)), t.category_id, c.name, c.color;


--
-- Name: v_expenses; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_expenses AS
 SELECT id,
    user_id,
    category_id,
    recurring_id,
    type,
    amount,
    currency,
    description,
    notes,
    transaction_date,
    payment_method,
    source,
    tags,
    created_at,
    updated_at,
    deleted_at
   FROM public.transactions
  WHERE ((type = 'EXPENSE'::public.transaction_type) AND (deleted_at IS NULL));


--
-- Name: v_incomes; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_incomes AS
 SELECT id,
    user_id,
    category_id,
    recurring_id,
    type,
    amount,
    currency,
    description,
    notes,
    transaction_date,
    payment_method,
    source,
    tags,
    created_at,
    updated_at,
    deleted_at
   FROM public.transactions
  WHERE ((type = 'INCOME'::public.transaction_type) AND (deleted_at IS NULL));


--
-- Name: v_monthly_cashflow; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_monthly_cashflow AS
 SELECT user_id,
    (date_trunc('month'::text, (transaction_date)::timestamp with time zone))::date AS month,
    sum(amount) FILTER (WHERE (type = 'INCOME'::public.transaction_type)) AS total_income,
    sum(amount) FILTER (WHERE (type = 'EXPENSE'::public.transaction_type)) AS total_expense,
    (COALESCE(sum(amount) FILTER (WHERE (type = 'INCOME'::public.transaction_type)), (0)::numeric) - COALESCE(sum(amount) FILTER (WHERE (type = 'EXPENSE'::public.transaction_type)), (0)::numeric)) AS net_balance,
    count(*) AS movements
   FROM public.transactions t
  WHERE (deleted_at IS NULL)
  GROUP BY user_id, (date_trunc('month'::text, (transaction_date)::timestamp with time zone));


--
-- Name: v_upcoming_obligations; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_upcoming_obligations AS
 SELECT o.user_id,
    o.id AS obligation_id,
    o.name AS obligation_name,
    o.type,
    i.id AS installment_id,
    i.number AS installment_number,
    i.due_date,
    i.amount,
    (i.amount - i.paid_amount) AS pending_amount,
    i.status,
    (i.due_date - CURRENT_DATE) AS days_until_due
   FROM (public.obligation_installments i
     JOIN public.obligations o ON ((o.id = i.obligation_id)))
  WHERE ((i.status = ANY (ARRAY['PENDING'::public.installment_status, 'PARTIAL'::public.installment_status, 'OVERDUE'::public.installment_status])) AND (o.status = 'ACTIVE'::public.obligation_status));


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_insights ai_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_pkey PRIMARY KEY (id);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_user_id_period_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_period_month_key UNIQUE (user_id, period_month);


--
-- Name: alert_preferences alert_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_pkey PRIMARY KEY (id);


--
-- Name: alert_preferences alert_preferences_user_id_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_user_id_type_key UNIQUE (user_id, type);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: budgets excl_budget_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT excl_budget_overlap EXCLUDE USING gist (user_id WITH =, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, daterange(period_start, period_end, '[]'::text) WITH &&) WHERE (is_active);


--
-- Name: obligation_installments obligation_installments_obligation_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligation_installments
    ADD CONSTRAINT obligation_installments_obligation_id_number_key UNIQUE (obligation_id, number);


--
-- Name: obligation_installments obligation_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligation_installments
    ADD CONSTRAINT obligation_installments_pkey PRIMARY KEY (id);


--
-- Name: obligations obligations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligations
    ADD CONSTRAINT obligations_pkey PRIMARY KEY (id);


--
-- Name: plans plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_code_key UNIQUE (code);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: projection_snapshots projection_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_snapshots
    ADD CONSTRAINT projection_snapshots_pkey PRIMARY KEY (id);


--
-- Name: recurring_transactions recurring_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_transactions
    ADD CONSTRAINT recurring_transactions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: alerts_agent_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX alerts_agent_key_unique ON public.alerts USING btree (user_id, ((metadata ->> 'agent_key'::text))) WHERE ((metadata ->> 'producer'::text) = 'moneymind-agents-v1'::text);


--
-- Name: idx_alerts_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_scheduled ON public.alerts USING btree (scheduled_for) WHERE (status = 'PENDING'::public.alert_status);


--
-- Name: idx_alerts_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_user_unread ON public.alerts USING btree (user_id, created_at DESC) WHERE (status = ANY (ARRAY['PENDING'::public.alert_status, 'SENT'::public.alert_status]));


--
-- Name: idx_budgets_user_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_user_period ON public.budgets USING btree (user_id, period_start, period_end) WHERE is_active;


--
-- Name: idx_calendar_events_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_user_date ON public.calendar_events USING btree (user_id, event_date);


--
-- Name: idx_categories_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_user ON public.categories USING btree (user_id, type) WHERE is_active;


--
-- Name: idx_conversations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_user ON public.ai_conversations USING btree (user_id, updated_at DESC) WHERE (NOT is_archived);


--
-- Name: idx_insights_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insights_user ON public.ai_insights USING btree (user_id, created_at DESC) WHERE (status <> 'DISMISSED'::public.insight_status);


--
-- Name: idx_installments_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installments_due ON public.obligation_installments USING btree (due_date) WHERE (status = ANY (ARRAY['PENDING'::public.installment_status, 'PARTIAL'::public.installment_status, 'OVERDUE'::public.installment_status]));


--
-- Name: idx_installments_obligation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installments_obligation ON public.obligation_installments USING btree (obligation_id, number);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.ai_messages USING btree (conversation_id, created_at);


--
-- Name: idx_obligations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligations_user ON public.obligations USING btree (user_id, status);


--
-- Name: idx_projections_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projections_user ON public.projection_snapshots USING btree (user_id, period_start DESC);


--
-- Name: idx_recurring_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_due ON public.recurring_transactions USING btree (next_occurrence_date) WHERE (is_active AND auto_generate);


--
-- Name: idx_recurring_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_user ON public.recurring_transactions USING btree (user_id, is_active);


--
-- Name: idx_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id, status);


--
-- Name: idx_tx_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_category ON public.transactions USING btree (category_id, transaction_date DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_tx_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_user_date ON public.transactions USING btree (user_id, transaction_date DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_tx_user_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_user_type_date ON public.transactions USING btree (user_id, type, transaction_date DESC) WHERE (deleted_at IS NULL);


--
-- Name: uq_alert_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_alert_dedupe ON public.alerts USING btree (user_id, type, related_entity_id, (((scheduled_for AT TIME ZONE 'UTC'::text))::date)) WHERE (related_entity_id IS NOT NULL);


--
-- Name: uq_category_system_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_category_system_name ON public.categories USING btree (lower((name)::text), type) WHERE (user_id IS NULL);


--
-- Name: uq_category_user_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_category_user_name ON public.categories USING btree (user_id, lower((name)::text), type) WHERE (user_id IS NOT NULL);


--
-- Name: uq_subscription_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_subscription_active ON public.subscriptions USING btree (user_id) WHERE (status = ANY (ARRAY['ACTIVE'::public.subscription_status, 'TRIALING'::public.subscription_status]));


--
-- Name: v_budget_status _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.v_budget_status AS
 SELECT b.id AS budget_id,
    b.user_id,
    b.name,
    b.category_id,
    c.name AS category_name,
    b.amount AS budget_amount,
    b.period_start,
    b.period_end,
    b.alert_threshold,
    COALESCE(sum(t.amount), (0)::numeric) AS spent_amount,
    (b.amount - COALESCE(sum(t.amount), (0)::numeric)) AS remaining_amount,
    round((COALESCE(sum(t.amount), (0)::numeric) / b.amount), 4) AS consumed_ratio
   FROM ((public.budgets b
     LEFT JOIN public.categories c ON ((c.id = b.category_id)))
     LEFT JOIN public.transactions t ON (((t.user_id = b.user_id) AND (t.type = 'EXPENSE'::public.transaction_type) AND (t.deleted_at IS NULL) AND ((t.transaction_date >= b.period_start) AND (t.transaction_date <= b.period_end)) AND ((b.category_id IS NULL) OR (t.category_id = b.category_id)))))
  WHERE b.is_active
  GROUP BY b.id, c.name;


--
-- Name: alert_preferences trg_alert_prefs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_alert_prefs_updated BEFORE UPDATE ON public.alert_preferences FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: budgets trg_budgets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_budgets_updated BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: categories trg_categories_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: ai_conversations trg_conversations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: ai_insights trg_insights_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_insights_updated BEFORE UPDATE ON public.ai_insights FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: obligation_installments trg_installments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_installments_updated BEFORE UPDATE ON public.obligation_installments FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: obligations trg_obligations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_obligations_updated BEFORE UPDATE ON public.obligations FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: plans trg_plans_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: recurring_transactions trg_recurring_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recurring_updated BEFORE UPDATE ON public.recurring_transactions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: subscriptions trg_subscriptions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: obligation_installments trg_sync_obligation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_obligation AFTER INSERT OR DELETE OR UPDATE OF paid_amount ON public.obligation_installments FOR EACH ROW EXECUTE FUNCTION public.fn_sync_obligation_totals();


--
-- Name: transactions trg_transactions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: users trg_users_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: ai_conversations ai_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_insights ai_insights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;


--
-- Name: ai_usage ai_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: alert_preferences alert_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: budgets budgets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: budgets budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: categories categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: obligation_installments obligation_installments_obligation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligation_installments
    ADD CONSTRAINT obligation_installments_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES public.obligations(id) ON DELETE CASCADE;


--
-- Name: obligation_installments obligation_installments_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligation_installments
    ADD CONSTRAINT obligation_installments_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: obligations obligations_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligations
    ADD CONSTRAINT obligations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: obligations obligations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligations
    ADD CONSTRAINT obligations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projection_snapshots projection_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projection_snapshots
    ADD CONSTRAINT projection_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recurring_transactions recurring_transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_transactions
    ADD CONSTRAINT recurring_transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: recurring_transactions recurring_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_transactions
    ADD CONSTRAINT recurring_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_recurring_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_recurring_id_fkey FOREIGN KEY (recurring_id) REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict db6RisdaOgXE9d57g6i7QFM1b90EvNTNBJf3h7NTGMihoCDDXndGeSdrkPSogJG

