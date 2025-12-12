-- CreateTable
CREATE TABLE "conventions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "convention_id" TEXT NOT NULL,
    "partner_name" TEXT NOT NULL,
    "aliases" TEXT NOT NULL,
    "client_type" TEXT NOT NULL,
    "documents" TEXT NOT NULL,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "eligibilities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "convention_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "family" BOOLEAN NOT NULL DEFAULT false,
    "family_details" TEXT,
    "subsidiaries" BOOLEAN NOT NULL DEFAULT false,
    "widows_invalids" BOOLEAN NOT NULL DEFAULT false,
    "second_access" BOOLEAN NOT NULL DEFAULT false,
    "second_access_condition" TEXT,
    "hierarchical" BOOLEAN NOT NULL DEFAULT false,
    "civil" BOOLEAN NOT NULL DEFAULT false,
    "adherents" BOOLEAN NOT NULL DEFAULT false,
    "conditions" TEXT,
    "details" TEXT,
    CONSTRAINT "eligibilities_convention_id_fkey" FOREIGN KEY ("convention_id") REFERENCES "conventions" ("convention_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "convention_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "technology" TEXT,
    "speed_mbps" INTEGER,
    "plan" TEXT,
    "volume_go" INTEGER,
    "frequency" TEXT,
    "product" TEXT,
    "type" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "price_convention_da" INTEGER NOT NULL,
    "price_public_da" INTEGER,
    "discount" TEXT,
    "condition" TEXT,
    "label" TEXT,
    "note" TEXT,
    CONSTRAINT "offers_convention_id_fkey" FOREIGN KEY ("convention_id") REFERENCES "conventions" ("convention_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "offres_referentiel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "id_offre" TEXT NOT NULL,
    "nom_commercial" TEXT NOT NULL,
    "famille" TEXT NOT NULL,
    "sous_famille" TEXT NOT NULL,
    "technologies" TEXT NOT NULL,
    "segments_cibles" TEXT NOT NULL,
    "sous_segments" TEXT NOT NULL,
    "client_type" TEXT NOT NULL,
    "locataire" BOOLEAN,
    "conventionne" BOOLEAN,
    "types_clients_exclus" TEXT NOT NULL,
    "type_offre" TEXT NOT NULL,
    "engagement_mois" INTEGER,
    "numero_document" TEXT NOT NULL,
    "canaux_activation" TEXT NOT NULL,
    "periode_activation" TEXT,
    "validite" TEXT,
    "debits_eligibles" TEXT,
    "caracteristiques_debit" TEXT,
    "tarification" TEXT NOT NULL,
    "avantages_principaux" TEXT NOT NULL,
    "limitations" TEXT NOT NULL,
    "conditions_particulieres" TEXT NOT NULL,
    "modes_paiement" TEXT NOT NULL,
    "documents_a_fournir" TEXT NOT NULL,
    "notes" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "offres_tableaux_tarifaires" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offre_id" TEXT NOT NULL,
    "type_tableau" TEXT NOT NULL,
    "unite_prix" TEXT NOT NULL,
    "lignes" TEXT NOT NULL,
    CONSTRAINT "offres_tableaux_tarifaires_offre_id_fkey" FOREIGN KEY ("offre_id") REFERENCES "offres_referentiel" ("id_offre") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "offres_produits_associes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offre_id" TEXT NOT NULL,
    "type_produit" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "tarif_actuel_da_ttc" INTEGER,
    "tarif_nouveau_da_ttc" INTEGER,
    "conditions" TEXT,
    CONSTRAINT "offres_produits_associes_offre_id_fkey" FOREIGN KEY ("offre_id") REFERENCES "offres_referentiel" ("id_offre") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "conventions_convention_id_key" ON "conventions"("convention_id");

-- CreateIndex
CREATE INDEX "conventions_partner_name_idx" ON "conventions"("partner_name");

-- CreateIndex
CREATE INDEX "conventions_client_type_idx" ON "conventions"("client_type");

-- CreateIndex
CREATE UNIQUE INDEX "eligibilities_convention_id_key" ON "eligibilities"("convention_id");

-- CreateIndex
CREATE INDEX "offers_convention_id_idx" ON "offers"("convention_id");

-- CreateIndex
CREATE INDEX "offers_category_idx" ON "offers"("category");

-- CreateIndex
CREATE INDEX "offers_technology_idx" ON "offers"("technology");

-- CreateIndex
CREATE INDEX "offers_price_convention_da_idx" ON "offers"("price_convention_da");

-- CreateIndex
CREATE INDEX "offers_speed_mbps_idx" ON "offers"("speed_mbps");

-- CreateIndex
CREATE UNIQUE INDEX "offres_referentiel_id_offre_key" ON "offres_referentiel"("id_offre");

-- CreateIndex
CREATE INDEX "offres_referentiel_famille_idx" ON "offres_referentiel"("famille");

-- CreateIndex
CREATE INDEX "offres_referentiel_client_type_idx" ON "offres_referentiel"("client_type");

-- CreateIndex
CREATE INDEX "offres_referentiel_locataire_idx" ON "offres_referentiel"("locataire");

-- CreateIndex
CREATE INDEX "offres_referentiel_conventionne_idx" ON "offres_referentiel"("conventionne");

-- CreateIndex
CREATE INDEX "offres_referentiel_nom_commercial_idx" ON "offres_referentiel"("nom_commercial");

-- CreateIndex
CREATE INDEX "offres_tableaux_tarifaires_offre_id_idx" ON "offres_tableaux_tarifaires"("offre_id");

-- CreateIndex
CREATE INDEX "offres_produits_associes_offre_id_idx" ON "offres_produits_associes"("offre_id");
