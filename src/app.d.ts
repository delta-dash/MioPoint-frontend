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
		content_id: number;
		start_timecode: string;
		end_timecode: string;
		transcript: string | null;
		tags: string[];
	}

	/**
	 * Represents the complete, structured record for a file,
	 * including its properties, tags, and scenes.
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

	// --- NEW/MODIFIED TYPES FOR PERSISTENT WATCH PARTY ---

	/**
	 * Represents the state of the user's current watch party session.
	 * This would live in a store, like wsStore.
	 */
	export interface WatchPartyState {
		threadId: number | null;
		// The fileId is now part of the party state, not a component prop.
		fileId: number | null;
		isOwner: boolean;
	}

	/**
	 * Payload for when the leader changes the file being watched.
	 * Leader -> Server
	 */
	export interface PartyFileChangeRequest {
		newFileId: number; // This would be the instance_id
	}

	/**
	 * Payload for when the server notifies clients of a file change.
	 * Server -> Clients
	 */
	export interface PartyFileChangedNotification {
		newFileId: number; // instance_id
	}

	/**
	 * Represents a summary of a single reaction type on a file instance,
	 * as returned by the backend.
	 */
	export interface ReactionSummary {
		id: number;
		name: string;
		label: string;
		emoji: string | null;
		image_path: string | null;
		count: number;
		reacted_by_user: boolean;
	}

	/**
	 * Represents the uploader's information, as returned by the backend.
	 */
	export interface FileUploader {
		id: number;
		username: string;
		roles: { id: number; name: string; rank: number }[];
	}

	export interface FileDetails {
		// Instance specific fields
		id: number; // This is the instance_id
		file_name: string;
		stored_path: string;
		ingest_source: string;
		original_created_at: string | null;
		original_modified_at: string | null;
		uploader: FileUploader | null;
		visibility_roles: Role[];
		folder_path: string | null;
		folder_id: number = null
		folder_name: string = null
		// Content specific fields
		content_id: number;
		file_hash: string;
		file_type: string;
		extension: string;
		phash: string | null;
		is_encrypted: boolean;
		is_webready: boolean;
		metadata: Record<string, any>;
		transcript: string | null;
		duration_seconds: number | null;
		size_in_bytes: number | null;
		tags: TagItem[];
		meta_tags: TagItem[];
		scenes: Scene[];
		reactions: ReactionSummary[];
	}

	export interface WorkerPoolStatus {
		workers: number;
		queue_size: number;
		active_tasks: number;
	}

	export interface ProcessingFileStatus {
		path: string;
		progress: number;
		message: string;
		elapsed: number;
		eta: number | null;
		ingest_source: string;
		priority: string;
	}

	export interface ScannerStatusData {
		processing_enabled: boolean;
		intake_queue_size: number;
		currently_processing_count: number;
		currently_processing: ProcessingFileStatus[];
		files_processed_session: number;
		watched_directories: string[];
		worker_pools: Record<string, WorkerPoolStatus>;
		config: {
			clip_model: string;
			tagger_model: string;
			index_rebuild_interval_minutes: number;
			model_idle_unload_seconds: number;
		};
	}

	export interface ApiSearchQuery {
		/** A general text search across file names, tags, and other metadata. */
		search?: string;

		/** A search specifically for text within video scene transcripts. */
		scene_search?: string;

		/** Filters for files with a specific name (can include wildcards depending on backend logic). */
		filename?: string;

		/** A single, comma-separated string of tags that files MUST have. */
		tags?: string;

		/** A single, comma-separated string of tags that files MUST NOT have. */
		exclude_tags?: string;

		/** A single, comma-separated string of meta-tags that files MUST have. */
		meta_tags?: string;

		/** A single, comma-separated string of meta-tags that files MUST NOT have. */
		exclude_meta_tags?: string;

		/** An array of file types (e.g., 'image', 'video') to filter by. */
		file_type?: string[];

		/** Filters for files that are either encrypted (true) or not encrypted (false). */
		is_encrypted?: boolean;

		/** The minimum duration of a media file in seconds. */
		duration_min?: number;

		/** The maximum duration of a media file in seconds. */
		duration_max?: number;

		/** The specific ID of a folder to search within. */
		folder_id?: number;

		/** The search mode, determining how folders and files are listed. */
		mode?: 'directory' | 'expanded' | 'recursive';

		/** The number of items to return per page. */
		page_size?: number;

		/** The pagination cursor for retrieving the next page of results. */
		cursor?: string;
	}

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

	}

	// --- END UPDATED SECTION ---

	export interface FolderItem {
		id: number;
		name: string;
		path: string;
	}

	/**
	 * Represents the complete, paginated response object from the `/api/cards` endpoint.
	 */
	export interface CardListingResponse {
		/** An array of file card objects for the current page. */
		items: ApiFileCard[];
		/**
		 * The cursor string needed to fetch the next page of results.
		 * If this is `null`, you have reached the last page.
		 */
		next_cursor: string | null;
		folders: FolderItem[] | null;
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
		key: 'search' | 'filename' | 'folder_id' | 'page_size';
		value: string;
	}
	interface FileTypeFilter extends BaseFilter {
		type: 'file_type';
		key: 'file_type';
		value: string[];
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
	interface ModeFilter extends BaseFilter {
		type: 'mode';
		key: 'mode';
		value: 'directory' | 'expanded' | 'recursive';
	}

	type ActiveFilter = TextFilter | TagsFilter | BooleanFilter | RangeFilter | FileTypeFilter | ModeFilter;



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
	export interface ConfigSchemaItem {
		name: string;
		description: string;
		type: 'bool' | 'int' | 'float' | 'str' | 'list_str' | 'list_path';
		value: any;
		category?: string;
	}
}

// src/lib/types.ts

/**
 * Represents a scene within a media file, including its
 * timecode, transcript, and associated tags.
 */

export { };