// ── SHIELD Mock Data ──────────────────────────────────────────────────────

// ── UDF FIELDS (exhaustive CDR fields) ───────────────────────────────────
export const UDF_FIELDS = [
  { key:"msisdn_a",label:"MSISDN appelant (A)",cat:"Identifiants",type:"text",agg:false,cdrField:"calling_number",unit:"" },
  { key:"msisdn_b",label:"MSISDN appelé (B)",cat:"Identifiants",type:"text",agg:false,cdrField:"called_number",unit:"" },
  { key:"imsi",label:"IMSI",cat:"Identifiants",type:"text",agg:false,cdrField:"imsi",unit:"" },
  { key:"imei",label:"IMEI (complet)",cat:"Identifiants",type:"text",agg:false,cdrField:"imei",unit:"" },
  { key:"imei_tac",label:"IMEI TAC (8 premiers)",cat:"Identifiants",type:"text",agg:false,cdrField:"imei_tac",unit:"" },
  { key:"imei_prefix6",label:"IMEI Préfixe (6 premiers)",cat:"Identifiants",type:"text",agg:false,cdrField:"imei_prefix",unit:"" },
  { key:"cell_id",label:"Cell ID (valeur exacte)",cat:"Identifiants",type:"text",agg:false,cdrField:"cell_id",unit:"" },
  { key:"lac",label:"LAC",cat:"Identifiants",type:"text",agg:false,cdrField:"lac",unit:"" },
  { key:"lac_ci",label:"LAC + Cell ID combiné",cat:"Identifiants",type:"text",agg:false,cdrField:"lac_ci",unit:"" },
  { key:"mcc",label:"MCC",cat:"Identifiants",type:"text",agg:false,cdrField:"mcc",unit:"" },
  { key:"mnc",label:"MNC",cat:"Identifiants",type:"text",agg:false,cdrField:"mnc",unit:"" },
  { key:"bts_id",label:"BTS / Node B ID",cat:"Identifiants",type:"text",agg:false,cdrField:"bts_id",unit:"" },
  { key:"apn",label:"APN (valeur)",cat:"Identifiants",type:"text",agg:false,cdrField:"apn",unit:"" },
  { key:"country_code_b",label:"Code pays appelé (B)",cat:"Identifiants",type:"text",agg:false,cdrField:"country_code_b",unit:"" },
  { key:"cell_lat",label:"Latitude Cell ID",cat:"Identifiants",type:"number",agg:false,cdrField:"cell_lat",unit:"deg" },
  { key:"cell_lng",label:"Longitude Cell ID",cat:"Identifiants",type:"number",agg:false,cdrField:"cell_lng",unit:"deg" },
  { key:"call_out_count",label:"Nb appels sortants",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"call_type=MO" },
  { key:"call_in_count",label:"Nb appels entrants",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"call_type=MT" },
  { key:"call_missed_out_count",label:"Nb appels manqués émis",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"dur<2,MO" },
  { key:"call_missed_in_count",label:"Nb appels manqués reçus",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"dur<2,MT" },
  { key:"call_total_dur_out",label:"Durée totale appels sortants (sec)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"sum",unit:"sec",cdrField:"duration,MO" },
  { key:"call_avg_dur_out",label:"Durée moyenne appel sortant (sec)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"avg",unit:"sec",cdrField:"duration,MO" },
  { key:"call_max_dur",label:"Durée max appel (sec)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"max",unit:"sec",cdrField:"duration" },
  { key:"call_min_dur",label:"Durée min appel (sec)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"min",unit:"sec",cdrField:"duration" },
  { key:"distinct_msisdn_b_out",label:"Nb destinations uniques (distinct MSISDN-B sortant)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"distinct",unit:"numéros",cdrField:"msisdn_b,MO" },
  { key:"distinct_msisdn_a_in",label:"Nb appelants uniques entrants",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"distinct",unit:"numéros",cdrField:"msisdn_a,MT" },
  { key:"call_fixed_count",label:"Nb appels vers fixes",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"fixed=true" },
  { key:"call_intl_out_count",label:"Nb appels internationaux sortants",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"intl=true,MO" },
  { key:"call_intl_in_count",label:"Nb appels internationaux entrants",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"intl=true,MT" },
  { key:"call_premium_count",label:"Nb appels vers surtaxés",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"premium=true" },
  { key:"call_roaming_count",label:"Nb appels en roaming",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"appels",cdrField:"roaming=true" },
  { key:"call_intl_out_pct",label:"% trafic international sortant",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"pct",unit:"%",cdrField:"intl=true,MO" },
  { key:"call_night_pct",label:"% appels nocturnes (22h-6h)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"pct",unit:"%",cdrField:"hour>=22||hour<6" },
  { key:"velocity_calls_per_min",label:"Vélocité appels / minute",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"velocity",unit:"appels/min",cdrField:"window=60s" },
  { key:"velocity_calls_per_sec",label:"Vélocité appels / seconde",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"velocity",unit:"appels/sec",cdrField:"window=1s" },
  { key:"min_interval_calls_sec",label:"Intervalle min entre appels (sec)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"min_interval",unit:"sec",cdrField:"MO" },
  { key:"avg_interval_calls_sec",label:"Intervalle moyen entre appels (sec)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"avg_interval",unit:"sec",cdrField:"MO" },
  { key:"ratio_out_in",label:"Ratio appels sortants/entrants",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"ratio",unit:"ratio",cdrField:"MO/MT" },
  { key:"distinct_cell_id",label:"Nb Cell IDs distincts",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"distinct",unit:"cells",cdrField:"cell_id" },
  { key:"distinct_lac",label:"Nb LAC distincts",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"distinct",unit:"LAC",cdrField:"lac" },
  { key:"distinct_countries_b",label:"Nb pays destination distincts",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"distinct",unit:"pays",cdrField:"country_code_b" },
  { key:"countries_b_list",label:"Liste pays destination",cat:"Voice — Agrégats",type:"text",agg:true,aggFunc:"list",unit:"texte",cdrField:"country_code_b" },
  { key:"seq_numbers_detected",label:"Nb séquences numéros détectées",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"seq_detect",unit:"séquences",cdrField:"msisdn_b" },
  { key:"active_hours_continuous",label:"Nb heures activité continue",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"continuous_h",unit:"heures",cdrField:"MO" },
  { key:"new_msisdn_b_pct",label:"% nouveaux numéros appelés",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"new_pct",unit:"%",cdrField:"msisdn_b" },
  { key:"cell_id_fixed_bool",label:"SIM fixe même antenne (>90%)",cat:"Voice — Agrégats",type:"boolean",agg:true,aggFunc:"fixed_bool",unit:"bool",cdrField:"cell_id" },
  { key:"distance_between_cells_km",label:"Distance entre Cell IDs (km)",cat:"Voice — Agrégats",type:"number",agg:true,aggFunc:"geo_dist",unit:"km",cdrField:"cell_lat,cell_lng" },
  { key:"sms_out_count",label:"Nb SMS sortants",cat:"SMS — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"SMS",cdrField:"sms_type=MO" },
  { key:"sms_in_count",label:"Nb SMS entrants",cat:"SMS — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"SMS",cdrField:"sms_type=MT" },
  { key:"distinct_sms_recipients",label:"Nb destinataires SMS uniques",cat:"SMS — Agrégats",type:"number",agg:true,aggFunc:"distinct",unit:"numéros",cdrField:"msisdn_b,sms_MO" },
  { key:"sms_intl_out_count",label:"Nb SMS internationaux sortants",cat:"SMS — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"SMS",cdrField:"intl=true,sms_MO" },
  { key:"sms_velocity_per_min",label:"Vélocité SMS / minute",cat:"SMS — Agrégats",type:"number",agg:true,aggFunc:"velocity",unit:"SMS/min",cdrField:"window=60s,sms_MO" },
  { key:"sms_bulk_campaign_bool",label:"Campagne SMS masse détectée",cat:"SMS — Agrégats",type:"boolean",agg:true,aggFunc:"bulk_bool",unit:"bool",cdrField:"sms_MO" },
  { key:"sms_flash_count",label:"Nb SMS Flash",cat:"SMS — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"SMS",cdrField:"flash=true" },
  { key:"data_volume_mb",label:"Consommation data totale (MB)",cat:"Data — Agrégats",type:"number",agg:true,aggFunc:"sum",unit:"MB",cdrField:"data_volume" },
  { key:"data_sessions_count",label:"Nb sessions data",cat:"Data — Agrégats",type:"number",agg:true,aggFunc:"count",unit:"sessions",cdrField:"data_session" },
  { key:"data_avg_mb_per_session",label:"MB moyen par session",cat:"Data — Agrégats",type:"number",agg:true,aggFunc:"avg",unit:"MB",cdrField:"data_volume" },
  { key:"sim_age_days",label:"Ancienneté SIM (jours)",cat:"SIM / Réseau",type:"number",agg:false,unit:"jours",cdrField:"activation_date" },
  { key:"sim_swap_count_30d",label:"Nb SIM Swap (30j)",cat:"SIM / Réseau",type:"number",agg:true,aggFunc:"count",unit:"swaps",cdrField:"sim_swap" },
  { key:"imei_change_count",label:"Nb changements IMEI",cat:"SIM / Réseau",type:"number",agg:true,aggFunc:"count",unit:"changements",cdrField:"imei_change" },
  { key:"location_change_count",label:"Nb changements Cell ID",cat:"SIM / Réseau",type:"number",agg:true,aggFunc:"count",unit:"changements",cdrField:"cell_id_change" },
  { key:"dormant_days_before",label:"Jours dormance avant activité",cat:"SIM / Réseau",type:"number",agg:false,unit:"jours",cdrField:"last_active_date" },
  { key:"promo_count",label:"Nb promos achetées",cat:"SIM / Réseau",type:"number",agg:true,aggFunc:"count",unit:"promos",cdrField:"promo_purchase" },
  { key:"shield_score",label:"Score SHIELD global",cat:"SIM / Réseau",type:"number",agg:false,unit:"/100",cdrField:"shield_score" },
  { key:"active_days_30",label:"Nb jours actifs (30j)",cat:"SIM / Réseau",type:"number",agg:true,aggFunc:"count_days",unit:"jours",cdrField:"active_days" },
  { key:"mm_sent_count",label:"Nb transactions MM envoyées",cat:"Mobile Money",type:"number",agg:true,aggFunc:"count",unit:"tx",cdrField:"mm_type=SEND" },
  { key:"mm_recv_count",label:"Nb transactions MM reçues",cat:"Mobile Money",type:"number",agg:true,aggFunc:"count",unit:"tx",cdrField:"mm_type=RECV" },
  { key:"mm_sent_amount_xof",label:"Montant total envoyé (XOF)",cat:"Mobile Money",type:"number",agg:true,aggFunc:"sum",unit:"XOF",cdrField:"mm_amount,SEND" },
  { key:"mm_recv_amount_xof",label:"Montant total reçu (XOF)",cat:"Mobile Money",type:"number",agg:true,aggFunc:"sum",unit:"XOF",cdrField:"mm_amount,RECV" },
  { key:"mm_max_single_tx_xof",label:"Montant max transaction unique (XOF)",cat:"Mobile Money",type:"number",agg:true,aggFunc:"max",unit:"XOF",cdrField:"mm_amount,SEND" },
  { key:"mm_daily_baseline_xof",label:"Moyenne quotidienne historique (XOF)",cat:"Mobile Money",type:"number",agg:false,unit:"XOF",cdrField:"mm_baseline" },
  { key:"mm_deviation_pct",label:"Déviation vs baseline (%)",cat:"Mobile Money",type:"number",agg:false,unit:"%",cdrField:"mm_deviation" },
  { key:"mm_distinct_recipients",label:"Nb bénéficiaires distincts",cat:"Mobile Money",type:"number",agg:true,aggFunc:"distinct",unit:"contacts",cdrField:"mm_recipient" },
  { key:"mm_new_recipients_count",label:"Nb nouveaux bénéficiaires",cat:"Mobile Money",type:"number",agg:true,aggFunc:"new_count",unit:"contacts",cdrField:"mm_recipient" },
  { key:"mm_new_recipients_pct",label:"% nouveaux bénéficiaires",cat:"Mobile Money",type:"number",agg:true,aggFunc:"new_pct",unit:"%",cdrField:"mm_recipient" },
  { key:"mm_velocity_per_hour",label:"Vélocité transactions MM / heure",cat:"Mobile Money",type:"number",agg:true,aggFunc:"velocity",unit:"tx/h",cdrField:"window=3600s" },
  { key:"mm_velocity_per_min",label:"Vélocité transactions MM / minute",cat:"Mobile Money",type:"number",agg:true,aggFunc:"velocity",unit:"tx/min",cdrField:"window=60s" },
  { key:"mm_cash_in_xof",label:"Total cash-in (XOF)",cat:"Mobile Money",type:"number",agg:true,aggFunc:"sum",unit:"XOF",cdrField:"mm_type=CASHIN" },
  { key:"mm_cash_out_xof",label:"Total cash-out (XOF)",cat:"Mobile Money",type:"number",agg:true,aggFunc:"sum",unit:"XOF",cdrField:"mm_type=CASHOUT" },
  { key:"mm_ratio_in_out",label:"Ratio cash-in/cash-out",cat:"Mobile Money",type:"number",agg:true,aggFunc:"ratio",unit:"ratio",cdrField:"CASHIN/CASHOUT" },
  { key:"mm_refund_count",label:"Nb remboursements MM",cat:"Mobile Money",type:"number",agg:true,aggFunc:"count",unit:"tx",cdrField:"mm_type=REFUND" },
  { key:"mm_failed_count",label:"Nb transactions MM échouées",cat:"Mobile Money",type:"number",agg:true,aggFunc:"count",unit:"tx",cdrField:"mm_status=FAILED" },
  { key:"mm_otp_attempts",label:"Nb tentatives OTP",cat:"Mobile Money",type:"number",agg:true,aggFunc:"count",unit:"tentatives",cdrField:"otp_attempt" },
  { key:"mm_merchant_tx_count",label:"Nb transactions marchands",cat:"Mobile Money",type:"number",agg:true,aggFunc:"count",unit:"tx",cdrField:"mm_type=MERCHANT" },
  { key:"mm_agent_tx_count",label:"Nb transactions agents",cat:"Mobile Money",type:"number",agg:true,aggFunc:"count",unit:"tx",cdrField:"mm_type=AGENT" },
  { key:"mm_night_tx_pct",label:"% transactions MM nocturnes",cat:"Mobile Money",type:"number",agg:true,aggFunc:"pct",unit:"%",cdrField:"hour>=22||hour<6" },
  { key:"mm_account_age_days",label:"Ancienneté compte MM (jours)",cat:"Mobile Money",type:"number",agg:false,unit:"jours",cdrField:"mm_account_created" },
  { key:"mm_kyc_verified_bool",label:"KYC vérifié",cat:"Mobile Money",type:"boolean",agg:false,unit:"bool",cdrField:"kyc_status" },
  { key:"mm_linked_accounts_count",label:"Nb comptes liés",cat:"Mobile Money",type:"number",agg:true,aggFunc:"count",unit:"comptes",cdrField:"linked_accounts" },
];

export const MOCK_USERS = [
  { id:"u1",name:"Papa Assane Diop",email:"admin@globalfraudmanagement.com",role:"superadmin",operator:null,active:true,lastLogin:"2026-06-06 08:30",avatar:"PA",createdAt:"2026-01-01" },
  { id:"u2",name:"Moussa Ndiaye",email:"moussa@orange.sn",role:"admin",operator:"Orange Sénégal",active:true,lastLogin:"2026-06-06 07:45",avatar:"MN",createdAt:"2026-02-15" },
  { id:"u3",name:"Aïssatou Fall",email:"aissatou@gfm.com",role:"gfm_analyst",operator:null,active:true,lastLogin:"2026-06-06 08:15",avatar:"AF",createdAt:"2026-03-01" },
  { id:"u4",name:"Ibrahima Sow",email:"ibrahima@gfm.com",role:"analyst",operator:"Yass Telecom",active:true,lastLogin:"2026-06-05 16:20",avatar:"IS",createdAt:"2026-03-10" },
  { id:"u5",name:"Fatou Diallo",email:"fatou@gfm.com",role:"supervisor",operator:"Expresso",active:true,lastLogin:"2026-06-06 09:00",avatar:"FD",createdAt:"2026-04-01" },
  { id:"u6",name:"Oumar Bâ",email:"oumar@expresso.sn",role:"admin",operator:"Expresso",active:false,lastLogin:"2026-05-20 14:30",avatar:"OB",createdAt:"2026-02-20" },
];

export const MOCK_CASES = [
  { id:"case1",name:"Foyer SIM Box — Plateau Dakar",description:"Concentration anormale de SIM Box sur les antennes du Plateau. Multiple boîtiers GSM identifiés.",type:"SIM Box",status:"open",priority:"critical",assignedTo:["u3"],createdBy:"u1",creatorName:"Papa Assane Diop",createdAt:"2026-06-04",tags:["simbox","plateau","dakar"],alertCount:47,slaHours:4,operator:"Orange Sénégal" },
  { id:"case2",name:"Campagne Wangiri — Séquences 77630x",description:"Campagne Wangiri massive utilisant des séquences commençant par 77630.",type:"Wangiri",status:"investigating",priority:"high",assignedTo:["u3","u4"],createdBy:"u2",creatorName:"Moussa Ndiaye",createdAt:"2026-06-03",tags:["wangiri","77630"],alertCount:234,slaHours:8,operator:"Orange Sénégal" },
  { id:"case3",name:"Arnaques Marabouts — Emirats",description:"Réseau d'arnaques type marabout ciblant les numéros locaux avec appels vers les Emirats.",type:"Arnaque Marabout",status:"open",priority:"high",assignedTo:["u4"],createdBy:"u1",creatorName:"Papa Assane Diop",createdAt:"2026-06-02",tags:["marabout","emirats"],alertCount:19,slaHours:24,operator:"Yass Telecom" },
  { id:"case4",name:"ATO Mobile Money — Vague juin",description:"Augmentation significative des Account Takeover sur les comptes Mobile Money.",type:"ATO",status:"closed",priority:"critical",assignedTo:["u3"],createdBy:"u2",creatorName:"Moussa Ndiaye",createdAt:"2026-05-28",tags:["ato","mobilemoney"],alertCount:31,slaHours:2,operator:"Orange Sénégal" },
];

export const MOCK_ALERTS = [
  { id:"a1",time:"08:34",msisdn:"77654XXXXX",operator:"Orange Sénégal",type:"SIM Box",severity:"critical",status:"alert",cellId:"BTS-DKR-042",score:94,assignedTo:"u3",caseId:"case1",slaDeadline:"2026-06-06 12:34",notes:[],createdAt:"2026-06-06 08:34",imei:"354921XXXXXXXX",imsi:"60801XXXXXXXXX",rule:"SIM Box — Vélocité haute" },
  { id:"a2",time:"08:29",msisdn:"78901XXXXX",operator:"Yass Telecom",type:"IRSF",severity:"high",status:"alert",cellId:"BTS-DKR-017",score:81,assignedTo:"u4",caseId:null,slaDeadline:"2026-06-06 16:29",notes:[],createdAt:"2026-06-06 08:29",imei:"356112XXXXXXXX",imsi:"60802XXXXXXXXX",rule:"IRSF — Trafic int'l" },
  { id:"a3",time:"08:21",msisdn:"77543XXXXX",operator:"Orange Sénégal",type:"Wangiri",severity:"high",status:"alert",cellId:"BTS-TBB-003",score:78,assignedTo:"u3",caseId:"case2",slaDeadline:"2026-06-06 16:21",notes:[],createdAt:"2026-06-06 08:21",imei:"357333XXXXXXXX",imsi:"60801XXXXXXXXX",rule:"Wangiri — Campagnes" },
  { id:"a4",time:"08:15",msisdn:"77987XXXXX",operator:"Expresso",type:"ATO",severity:"critical",status:"alert",cellId:"BTS-GUE-011",score:91,assignedTo:null,caseId:null,slaDeadline:"2026-06-06 10:15",notes:[],createdAt:"2026-06-06 08:15",imei:"358554XXXXXXXX",imsi:"60803XXXXXXXXX",rule:"MM — ATO post SIM Swap" },
  { id:"a5",time:"07:58",msisdn:"77612XXXXX",operator:"Orange Sénégal",type:"Dépassement comportemental",severity:"critical",status:"alert",cellId:"BTS-DKR-042",score:88,assignedTo:"u3",caseId:"case4",slaDeadline:"2026-06-06 09:58",notes:[],createdAt:"2026-06-06 07:58",imei:"359775XXXXXXXX",imsi:"60801XXXXXXXXX",rule:"MM — Dépassement comportemental x5" },
  { id:"a6",time:"07:44",msisdn:"77234XXXXX",operator:"Yass Telecom",type:"Arnaque Marabout",severity:"high",status:"alert",cellId:"BTS-PIC-007",score:73,assignedTo:null,caseId:"case3",slaDeadline:"2026-06-07 07:44",notes:[],createdAt:"2026-06-06 07:44",imei:"360996XXXXXXXX",imsi:"60802XXXXXXXXX",rule:"Arnaque Marabout — Fixe + Emirats" },
];

export const MOCK_BLOCKINGS = [
  { id:"b1",msisdn:"77654XXXXX",imei:"354921XXXXXXXX",imsi:"60801XXXXXXXXX",cellId:"BTS-DKR-042",operator:"Orange Sénégal",blockedBy:"u3",blockerName:"Aïssatou Fall",reason:"SIM Box confirmée — Règle automatique",source:"shield_auto",date:"2026-06-04 08:35",active:true,autoFlagged:["354921","BTS-DKR-042"] },
  { id:"b2",msisdn:"78901XXXXX",imei:"356112XXXXXXXX",imsi:"60802XXXXXXXXX",cellId:"BTS-DKR-017",operator:"Yass Telecom",blockedBy:"u4",blockerName:"Ibrahima Sow",reason:"IRSF — Trafic international massif",source:"analyst",date:"2026-06-04 09:12",active:true,autoFlagged:[] },
  { id:"b3",msisdn:"77543XXXXX",imei:"357333XXXXXXXX",imsi:"60801XXXXXXXXX",cellId:"BTS-TBB-003",operator:"Orange Sénégal",blockedBy:"u3",blockerName:"Aïssatou Fall",reason:"Wangiri — Campagne séquentielle",source:"shield_auto",date:"2026-06-03 14:20",active:true,autoFlagged:[] },
  { id:"b4",msisdn:"77987XXXXX",imei:"358554XXXXXXXX",imsi:"60803XXXXXXXXX",cellId:"BTS-GUE-011",operator:"Expresso",blockedBy:"u1",blockerName:"Papa Assane Diop",reason:"Detection inter-opérateur — Orange Sénégal",source:"inter_operator",date:"2026-06-02 10:00",active:false,autoFlagged:[] },
];

export const MOCK_OPERATORS = [
  { id:"op1",name:"Orange Sénégal",country:"SN",code:"OG",active:true,rules:12,detections:1240,blocked:1187,mm:true,slaEnabled:true,slaConfig:{critical:2,high:8,medium:24},packs:{mm:true,ai:true,deepAI:false},contact:"tech@orange.sn",contractStart:"2026-01-01",monthlyFee:500000,perAlertFee:5,perBlockFee:10,perAIFee:500 },
  { id:"op2",name:"Yass Telecom",country:"SN",code:"YS",active:true,rules:8,detections:342,blocked:298,mm:false,slaEnabled:false,slaConfig:null,packs:{mm:false,ai:false,deepAI:false},contact:"admin@yass.sn",contractStart:"2026-02-15",monthlyFee:250000,perAlertFee:5,perBlockFee:10,perAIFee:500 },
  { id:"op3",name:"Expresso",country:"SN",code:"EX",active:true,rules:6,detections:89,blocked:72,mm:false,slaEnabled:true,slaConfig:{critical:4,high:12,medium:48},packs:{mm:false,ai:false,deepAI:false},contact:"security@expresso.sn",contractStart:"2026-03-01",monthlyFee:200000,perAlertFee:5,perBlockFee:10,perAIFee:500 },
];

export const MOCK_RULES = [
  { id:1,name:"SIM Box — Vélocité haute + zéro data",type:"SIM Box",active:true,severity:"critical",action:"block",scope:"global",triggered:127,blocked:127,date:"2026-05-12",createdBy:"u1",creatorName:"Papa Assane Diop",caseId:"case1",operator:null,conditions:[{field:"call_out_count",comparator:">",value:"50",logic:null},{field:"velocity_calls_per_min",comparator:">",value:"5",logic:"ET"},{field:"data_volume_mb",comparator:"<",value:"1",logic:"ET"},{field:"cell_id_fixed_bool",comparator:"=",value:"1",logic:"ET"}] },
  { id:2,name:"IRSF — Trafic international massif",type:"IRSF",active:true,severity:"critical",action:"block",scope:"global",triggered:34,blocked:34,date:"2026-05-16",createdBy:"u2",creatorName:"Moussa Ndiaye",caseId:null,operator:"Orange Sénégal",conditions:[{field:"call_intl_out_count",comparator:">",value:"20",logic:null},{field:"call_premium_count",comparator:">",value:"10",logic:"ET"}] },
  { id:3,name:"Wangiri — Appels courts séquentiels",type:"Wangiri",active:true,severity:"critical",action:"block",scope:"global",triggered:234,blocked:234,date:"2026-05-20",createdBy:"u1",creatorName:"Papa Assane Diop",caseId:"case2",operator:null,conditions:[{field:"call_avg_dur_out",comparator:"<",value:"4",logic:null},{field:"call_missed_out_count",comparator:">",value:"100",logic:"ET"}] },
  { id:4,name:"MM — Dépassement comportemental x5",type:"Dépassement comportemental",active:true,severity:"critical",action:"block_mm_tx",scope:"global",triggered:67,blocked:67,date:"2026-05-12",createdBy:"u1",creatorName:"Papa Assane Diop",caseId:null,operator:null,conditions:[{field:"mm_deviation_pct",comparator:">",value:"400",logic:null},{field:"mm_sent_amount_xof",comparator:">",value:"100000",logic:"ET"}] },
  { id:5,name:"MM — ATO post SIM Swap",type:"ATO",active:true,severity:"critical",action:"block_mm_tx",scope:"global",triggered:31,blocked:31,date:"2026-05-14",createdBy:"u3",creatorName:"Aïssatou Fall",caseId:"case4",operator:null,conditions:[{field:"sim_swap_count_30d",comparator:">",value:"0",logic:null},{field:"mm_new_recipients_count",comparator:">",value:"3",logic:"ET"}] },
  { id:6,name:"Arnaque Marabout — Fixe + Emirats",type:"Arnaque Marabout",active:true,severity:"high",action:"block",scope:"global",triggered:43,blocked:43,date:"2026-05-28",createdBy:"u2",creatorName:"Moussa Ndiaye",caseId:"case3",operator:"Yass Telecom",conditions:[{field:"call_fixed_count",comparator:">",value:"30",logic:null},{field:"countries_b_list",comparator:"contient",value:"AE,MA,MR",logic:"ET"}] },
];

export const MOCK_BLACKLIST = [
  { id:1,list:"blacklist",type:"MSISDN",value:"77654XXXXX",reason:"SIM Box confirmée",addedBy:"u3",date:"2026-06-04",active:true,matches:127,lastMatch:"2026-06-04 08:34" },
  { id:2,list:"blacklist",type:"IMEI Préfixe",value:"354921",reason:"Lot IMEI SIM Box",addedBy:"u1",date:"2026-06-03",active:true,matches:47,lastMatch:"2026-06-04 07:58" },
  { id:3,list:"blacklist",type:"Préfixe numéro",value:"77630",reason:"Campagne Wangiri",addedBy:"u3",date:"2026-06-02",active:true,matches:234,lastMatch:"2026-06-04 08:21" },
  { id:4,list:"blacklist",type:"Cell ID / BTS",value:"BTS-DKR-042",reason:"Anomalie trafic +919%",addedBy:"u1",date:"2026-06-04",active:true,matches:89,lastMatch:"2026-06-04 08:34" },
  { id:5,list:"whitelist",type:"MSISDN",value:"77100XXXXX",reason:"Service client Orange",addedBy:"u2",date:"2026-05-20",active:true,matches:0,lastMatch:null },
  { id:6,list:"watchlist",type:"MSISDN",value:"77543XXXXX",reason:"Sous observation 7j",addedBy:"u3",date:"2026-06-03",active:true,matches:8,lastMatch:"2026-06-04 07:44",daysLeft:5 },
];

export const MOCK_COMPLAINTS = [
  { id:1,msisdn:"77654XXXXX",tag:"Arnaque marabout",summary:"Numéro signalé pour arnaque type marabout. Sollicite 50 000 FCFA. Schéma classique d'extorsion spirituelle.",raw:"Bonjour, le numéro 77 654 3210 m'a appelé en disant qu'il est un grand marabout. Il demande 50000 FCFA. C'est une arnaque.",date_raw:"2026-06-04 09:12",confidence:97,operator:"Orange Sénégal" },
  { id:2,msisdn:"78901XXXXX",tag:"Fraude",summary:"Usurpation d'identité opérateur Orange. Soutire le code secret sous prétexte de déblocage de compte.",raw:"Ce numero 78901 4567 ma arnaquer il se faisait passer pour orange et ma demander mon code secret.",date_raw:"2026-06-04 08:45",confidence:91,operator:"Yass Telecom" },
  { id:3,msisdn:"77987XXXXX",tag:"Escroquerie",summary:"Usurpation identité police. Exige amende fictive via Wave Money ciblant personnes âgées.",raw:"Le 77987 6543 appelle mes parents en disant être de la police et demande une amende par wave money.",date_raw:"2026-06-03 11:05",confidence:95,operator:"Expresso" },
];

export const MOCK_LOGS = [
  { id:"l1",ts:"2026-06-06 08:34:12",userId:"u3",userName:"Aïssatou Fall",userRole:"gfm_analyst",action:"BLOCK_SIM",entity:"alert",entityId:"a1",detail:"Blocage SIM 77654XXXXX — Score 94 — SIM Box",page:"SimProfile",ip:"192.168.1.45" },
  { id:"l2",ts:"2026-06-06 08:30:05",userId:"u1",userName:"Papa Assane Diop",userRole:"superadmin",action:"LOGIN",entity:"auth",entityId:null,detail:"Connexion réussie — superadmin — GFM",page:"Login",ip:"192.168.1.10" },
  { id:"l3",ts:"2026-06-06 08:25:01",userId:"u3",userName:"Aïssatou Fall",userRole:"gfm_analyst",action:"ADD_BLACKLIST",entity:"blacklist",entityId:"1",detail:"Ajout MSISDN 77654XXXXX — SIM Box confirmée",page:"Listes",ip:"192.168.1.45" },
  { id:"l4",ts:"2026-06-06 08:20:44",userId:"u1",userName:"Papa Assane Diop",userRole:"superadmin",action:"CREATE_RULE",entity:"rule",entityId:"1",detail:"Création règle 'SIM Box — Vélocité haute + zéro data' — 4 conditions",page:"Règles",ip:"192.168.1.10" },
  { id:"l5",ts:"2026-06-06 08:15:22",userId:"u3",userName:"Aïssatou Fall",userRole:"gfm_analyst",action:"LOGIN",entity:"auth",entityId:null,detail:"Connexion réussie — gfm_analyst — GFM",page:"Login",ip:"192.168.1.45" },
  { id:"l6",ts:"2026-06-06 08:10:11",userId:"u1",userName:"Papa Assane Diop",userRole:"superadmin",action:"CREATE_CASE",entity:"case",entityId:"case1",detail:"Création case 'Foyer SIM Box — Plateau Dakar' — Critique",page:"Cases",ip:"192.168.1.10" },
  { id:"l7",ts:"2026-06-06 08:05:33",userId:"u2",userName:"Moussa Ndiaye",userRole:"admin",action:"EDIT_RULE",entity:"rule",entityId:"2",detail:"Modification règle 'IRSF' — Condition modifiée",page:"Règles",ip:"192.168.1.33" },
];

export const CELL_ANOMALIES = [
  { id:"BTS-DKR-042",name:"Dakar — Plateau 042",prev:210,curr:2140,delta:"+919%",status:"critical",lat:14.6937,lng:-17.4441,sims:[
    { msisdn:"77654XXXXX",score:94,callsOut:3240,sms:2,data:0.1,status:"blocked",imei:"354921XXXXXXXX" },
    { msisdn:"77612XXXXX",score:91,callsOut:2890,sms:0,data:0.0,status:"blocked",imei:"354921XXXXXXXX" },
    { msisdn:"77630XXXXX",score:87,callsOut:2100,sms:1,data:0.2,status:"alert",imei:"356112XXXXXXXX" },
  ]},
  { id:"BTS-TBB-003",name:"Thiès — Banlieue 003",prev:180,curr:890,delta:"+394%",status:"high",lat:14.7886,lng:-16.9260,sims:[
    { msisdn:"77543XXXXX",score:78,callsOut:890,sms:2,data:0.2,status:"alert",imei:"357333XXXXXXXX" },
  ]},
];

export const TREND_DATA = [
  { d:"J-6",v:187 },{ d:"J-5",v:234 },{ d:"J-4",v:198 },
  { d:"J-3",v:312 },{ d:"J-2",v:267 },{ d:"J-1",v:289 },{ d:"Auj",v:351 },
];
export const WEEKLY_DATA = [
  { d:"Lun",simbox:45,irsf:12,wangiri:89,mm:34,other:23 },
  { d:"Mar",simbox:67,irsf:8,wangiri:134,mm:45,other:31 },
  { d:"Mer",simbox:38,irsf:19,wangiri:67,mm:28,other:18 },
  { d:"Jeu",simbox:92,irsf:24,wangiri:45,mm:67,other:42 },
  { d:"Ven",simbox:54,irsf:11,wangiri:98,mm:43,other:27 },
  { d:"Sam",simbox:28,irsf:6,wangiri:34,mm:19,other:9 },
  { d:"Dim",simbox:19,irsf:3,wangiri:21,mm:12,other:7 },
];
export const PIE_DATA = [
  { name:"SIM Box",value:28,color:"#E83A2E" },
  { name:"Wangiri",value:20,color:"#5BB8E8" },
  { name:"Mobile Money",value:22,color:"#14B8A6" },
  { name:"IRSF",value:14,color:"#F59E0B" },
  { name:"Autres",value:16,color:"#E8EDF5" },
];