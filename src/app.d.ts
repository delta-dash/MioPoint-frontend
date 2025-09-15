// app.d.ts

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
		interface PageState {
			selected: any;
		}
	}


	// --- Types ---
	interface Thread {
		id: number;
		type: string;
		name: string | null;
		picture_url: string | null;
		role: string;
	}

	interface PublicThread {
		id: number;
		type: string;
		name: string | null;
		picture_url: string | null;
	}
	
	export interface FileItem {
		id: number;
		display_name: string;
	}

	export interface PageData {
		items: FileItem[];
		next_cursor: string | null;
	}
	export interface Scene {
		id: number;
		file_id: number;
		start_timecode: string;
		end_timecode: string;
		transcript: string | null;
		tags: string[];
	}

	/**
	 * Represents the complete, structured record for a file,
	 * including its properties, tags, and scenes.
	 * This matches the JSON object from the /api/file/{file_id} endpoint.
	 */

	export interface Role {
		id: number
		name: string
		rank: number
	}

	export interface RolePermissions {
		id: number,
		name: string,
		description: string
	}
	export interface RoleDetail extends Role {
		permissions: RolePermissions[];
	}

	export interface UserProfile {
		username: string,
		id: number,
		is_guest: boolean,
		is_active: boolean,
		roles: { id: number, name: string, rank: number, permissions: RolePermissions[] }[],
		permissions: RolePermissions[]
	}


	export type roles_with_permissions = {
		name: string[]
	}
	export interface ClientData {
		user_details: {
			id: number | null,
			is_guest: boolean,
			username: string,
			roles_with_permissions: Record<string, Permission>[],
			all_permissions: Permission[]
		},
		tags: TagItem[],
		roles: Role[],
		metatags: TagItem[]
	}

    // --- UPDATED SECTION ---

    /**
     * Represents the uploader's information, as returned by the backend.
     */
	export interface FileUploader {
		id: number;
		username: string;
		roles: { id: number; name: string; rank: number }[];
	}

	export interface FileDetails {
		id: number;
		file_name: string;
		file_hash: string;
		file_type: string;
		extension: string;
		stored_path: string;
		phash: string | null;
		is_encrypted: boolean; // Changed from number to boolean
		metadata: string; // JSON string, consider parsing to object
		transcript: string | null;
		discovered_at: string; // ISO timestamp
		processed_at: string;  // ISO timestamp
		ingest_source: string;
		transcoded_path: string | null;
		duration_seconds: number | null;
		original_created_at: string;
		original_modified_at: string;
		size_in_bytes: number | null; // <-- NEW
		uploader: FileUploader | null;
		tags: string[];
		meta_tags: string[];
		scenes: Scene[];
		visibility_roles: Role[];
	}
	export type ApiSearchQuery = {
		search?: string;
		filename?: string;
		tags?: string;
		exclude_tags?: string;
		meta_tags?: string;
		exclude_meta_tags?: string;
		file_type?: string[];
		is_encrypted?: boolean;
		duration_min?: number;
		duration_max?: number;
	};
	export interface ApiFileCard {
		/** The unique numeric ID of the file in the database. */
		id: number;

		/** The display-friendly name of the file (e.g., "my-vacation-photo.jpg"). */
		display_name: string;

		/** The detected type of the file (e.g., "image", "video", "audio"). */
		file_type: string; // <-- CORRECTED: Type is non-nullable per Pydantic model

		/** True if the file is marked as encrypted, otherwise false. */
		is_encrypted: boolean;

		/** The unique SHA256 hash of the file content. Can be null. */
		file_hash: string | null; // <-- CORRECTED: Hash can be optional

		/** The duration of the media in seconds. Null for non-media files like images. */
		duration_seconds: number | null;

		/** The original creation date of the file, as an ISO 8601 timestamp string (e.g., "2023-10-27T14:30:00"). */
		original_created_at: string | null;

		/** A Unix epoch timestamp (number of seconds since 1970-01-01) indicating when the file was discovered by the system. Useful for sorting by "newest". */
		timestamp: number;
	}

    // --- END UPDATED SECTION ---


	/**
	 * Represents the complete, paginated response object from the `/api/cards` endpoint.
	 */
	export interface PaginatedFileResponse {
		/** An array of file card objects for the current page. */
		items: ApiFileCard[];

		/** 
		 * The cursor string needed to fetch the next page of results.
		 * If this is `null`, you have reached the last page.
		 */
		next_cursor: string | null;
	}
	// All possible filter keys we can add.
	type FilterKey = keyof ApiSearchQuery;

	// Discriminated unions for type-safe active filters.
	interface BaseFilter {
		id: number; // Unique ID for `{#each}` keying
		key: FilterKey;
		label: string;
	}
	interface TextFilter extends BaseFilter {
		type: 'text';
		key: 'search' | 'filename' | 'file_type';
		value: string;
	}
	interface TagsFilter extends BaseFilter {
		type: 'tags';
		key: 'tags' | 'exclude_tags' | 'meta_tags' | 'exclude_meta_tags';
		value: string[];
	}
	interface BooleanFilter extends BaseFilter {
		type: 'boolean';
		key: 'is_encrypted';
		value: boolean;
	}
	interface RangeFilter extends BaseFilter {
		type: 'range';
		key: 'duration_min' | 'duration_max'; // We'll handle this as one filter UI
		min: number | null;
		max: number | null;
	}

	type ActiveFilter = TextFilter | TagsFilter | BooleanFilter | RangeFilter;



	type TagType = 'tags' | 'meta_tags';
	export type TagItem = {
		id: number
		name: string
	}
	type TagReference = { id: number; name: string };
	type TagDetail = {
		id: number;
		name: string;
		parents: TagReference[];
		canonical_tag: TagReference | null;
		is_alias: boolean;
		is_protection_tag: boolean;
	};
	type CreateTagPayload = {
		name: string;
		is_protection_tag?: boolean;
		parents?: string[];
		alias_of?: string;
	};
	type EditTagPayload = {
		name?: string;
		parents?: string[];
		alias_of?: string | null; // Can send null to remove
		is_protection_tag?: boolean;
	};
}
// src/lib/types.ts

/**
 * Represents a scene within a media file, including its
 * timecode, transcript, and associated tags.
 */

export { };