import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

type GameFilters = {
    categoryIds?: number[];
    categoryId?: number | null;
    publisherIds?: number[];
    publisherId?: number | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function normalizeIdList(value: number | number[] | null | undefined): number[] {
    if (value === null || value === undefined) {
        return [];
    }

    const values = Array.isArray(value) ? value : [value];
    return values
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0);
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** All categories ordered by name. */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All publishers ordered by name. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getFilteredGames(db);
}

/** All games matching the supplied category filter(s). */
export async function getGamesByCategory(db: Database, categoryIds: number | number[]): Promise<Game[]> {
    return getFilteredGames(db, { categoryIds: normalizeIdList(categoryIds) });
}

/** All games matching the supplied publisher filter(s). */
export async function getGamesByPublisher(db: Database, publisherId: number | number[]): Promise<Game[]> {
    return getFilteredGames(db, { publisherIds: normalizeIdList(publisherId) });
}

/** All games matching optional category and publisher filters. */
export async function getFilteredGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const categoryIds = [...new Set([
        ...normalizeIdList(filters.categoryId),
        ...normalizeIdList(filters.categoryIds),
    ])];
    const publisherIds = [...new Set([
        ...normalizeIdList(filters.publisherId),
        ...normalizeIdList(filters.publisherIds),
    ])];

    const conditions = [];

    if (categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, publisherIds));
    }

    const rows =
        conditions.length > 0
            ? await baseGamesQuery(db).where(and(...conditions)).orderBy(asc(games.title))
            : await baseGamesQuery(db).orderBy(asc(games.title));

    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
