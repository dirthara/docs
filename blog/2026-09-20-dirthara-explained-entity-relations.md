---
title: Explaining Dirthara Entity Relations
authors: [dirthara]
draft: true
tags: [entity, relations, database, documentation]
---

# Dirthara Explained: Entity Relations

In the previous article we explored how to create and use entities in Dirthara. Now we will dive into how to define
relations between entities. The basic idea for relations is the same as for the entities themselves: plain PHP
properties on the entity class. For relations, you do have to define the type of relation because we can't infer it from
the property type. Maybe in the future, when generics are finally supported, we can infer more information about the
relation by default, and we can simplify the API a little more.

There are three basic relation cardinalities: one-to-one, one-to-many/many-to-one, and many-to-many. Dirthara represents
these using four relation types: `HasOne`, `HasMany`, `BelongsToOne`, and `BelongsToMany`. These names might sound 
familiar if you've used other frameworks before, and that, again, is deliberate. We've chosen to use the terminology 
from the perspective of the code, not the database, just like we did with the Entity Query when it comes to properties 
and values.

{/* truncate */}

Let's take a look at an example. Let's expand the Post entity from the previous article and add a relation for
each of the four relation types.

```php
<?php

declare(strict_types=1);

namespace App\Blog\Domain\Entity;

use DateTimeInterface;
use App\Blog\Domain\Entity\Tag;
use App\User\Domain\Entity\User;
use Dirthara\Entity\Attribute\Id;
use App\Blog\Domain\Entity\Comment;
use App\Blog\Domain\Entity\PostSeo;
use Dirthara\Entity\Attribute\HasOne;
use Dirthara\Entity\Attribute\HasMany;
use Dirthara\Entity\Attribute\Generated;
use Dirthara\Entity\Attribute\BelongsToOne;
use Dirthara\Collection\Contract\Collection;
use Dirthara\Entity\Attribute\BelongsToMany;

final class Post
{
    #[Id]
    #[Generated]
    public readonly int $id;

    public function __construct(
        public string $title,
        public string $content,
        public DateTimeInterface $createdAt,
        public ?DateTimeInterface $publishedAt,
        
        #[BelongsToOne]
        public User $author,
        
        #[HasOne]
        public ?PostSeo $seo,
        
        #[HasMany(Comment::class)]
        public Collection $comments,
        
        #[BelongsToMany(Tag::class)]
        public Collection $tags,
    ) {}
}
```

As you can see, the relation attributes are all pretty straightforward and work the same way as the `Column` attribute.
You can add more options to the relation attributes, which you can read about in the [documentation](https://dirthara.github.io/docs/), 
but for the purpose of the article we'll keep things simple.

- The `BelongsToOne` relation is a many-to-one relation that means that the Post belongs to a single User. This translates into an `author_id` column on the Post table in the database.
- The `HasOne` relation is a one-to-one relation that means that the Post has a single PostSeo. This translates into a `post_id` column on the PostSeo table in the database.
- The `HasMany` relation is a one-to-many relation that means that the Post has many Comments. This translates into a `post_id` column on the Comment table in the database.
- The `BelongsToMany` relation is a many-to-many relation that means that the Post belongs to many Tags, and a Tag belongs to many Posts. This translates into a pivot table that has `post_id` and `tag_id` columns.

:::tip
You may have noticed that the `HasOne` and `HasMany` relations are described as the same in terms of the database schema.
This might seem a bit redundant, but the `HasOne` relation actually enforces a one-to-one relationship when loading and
mutating the relation, while the `HasMany` relation does not care how many items are in the relation.
:::

:::info
The naming for relation columns and pivot tables uses the same Naming Strategy that columns and entities use. The
`NamingStrategy` we discussed in the previous article has three more methods:
`relationForeignKey(string $property, string $identifierColumn)`,
`entityForeignKey(string $entityShortName, string $identifierColumn)` and
`joinTable(string $entityShortName, string $relatedEntityShortName)`. These methods are used to customise the
naming of the relation columns and pivot tables. Of course, you can pass all relevant information to the
attribute as well, which takes precedence over the naming strategy.
:::

## There is no lazy loading in Dirthara

Lazy loading sounds like a good idea when you first hear about it: only load the data when you need it. But it is
really easy to create N+1 queries, which have O(N) complexity, or even O(N²) query patterns when lazy-loaded relations
are accessed inside nested loops. It's a trap many developers fall into, even experienced ones.

We want developers who work with Dirthara to become better PHP developers, not just better Dirthara developers.

Dirthara, therefore, **does not support lazy loading**. But what is the alternative? Always use eager loading for
everything? That is also not what you want, because that would mean you are loading everything at once, even if you
might not need it.

Dirthara uses a different concept instead: **explicit loading**. This means that you have to explicitly load the
relations you need when you need them instead of relying on the framework to load them lazily when you access them for
the first time. You can still use eager loading on relations you know you will always need, but instead of silently
loading a relation in the background when accessed, you need to explicitly load it.

When using relations, therefore, as a developer, you always know with certainty when the framework triggers a database 
query and when it does not. Accessing a relation property never triggers a database query. Relations are only loaded 
when you explicitly request them, either when defining the query, when explicitly loading them afterwards, or by 
configuring the relation to use eager loading.

Let's continue with the same Post example from before, and let's say we have a `User` entity that `HasMany` Posts. We
probably don't want to load all the posts of the user every time, only when we actually need them.

```php
<?php

declare(strict_types=1);

use App\Blog\Domain\Entity\Post;
use App\User\Domain\Entity\User;

$user = $entityManager->of(User::class)->findOrFail(1); // Load the user.

foreach ($user->posts as $post) { // --> Error: Typed property App\User\Domain\Entity\User::$posts must not be accessed before initialization
    // Do something with the post.
}
```

This would be the pattern you might be used to, but in Dirthara, this will result in an error. That is because
relations are explicit by default in Dirthara. That means you need to explicitly load the relations you need when you
need them, or tell the relation to always use eager loading.

### Explicit loading

```php
<?php

declare(strict_types=1);

use App\User\Domain\Entity\User;

// Set up the entity manager.

$entityStore = $entityManager->of(User::class);

$user = $entityStore->findOrFail(1); // Load the user.
$entityStore->load($user, 'posts'); // Explicitly load the posts on the user we already have.

foreach ($user->posts as $post) { // --> $user->posts now contains the posts.
    // Do something with the post.
}
```

### Eager loading on the query

```php
<?php

declare(strict_types=1);

use App\Blog\Domain\Entity\Post;
use App\User\Domain\Entity\User;

// Set up the entity manager.

$users = $entityManager
    ->of(User::class)
    ->query()
    ->with('posts') // Eager load the posts for each user.
    ->get()
;

foreach ($users as $user) {
    foreach ($user->posts as $post) {
        // Do something with the post.
    }
}
```

When fetching multiple users in one query, you can use the `with` method to eager load the relations for each user. The
example above would result in two queries: one to fetch the users and one to fetch the posts for all users.

### Eager loading on the property

```php
<?php

declare(strict_types=1);

namespace App\User\Domain\Entity;

use App\Blog\Domain\Entity\Post;
use Dirthara\Entity\Attribute\HasMany;
use Dirthara\Collection\Contract\Collection;
use Dirthara\Entity\Relation\RelationLoading;

final class User
{
    // ... Other properties.

    #[HasMany(target: Post::class, loading: RelationLoading::Eager)]
    public Collection $posts;
}
```

The above example would result in the posts always being loaded on every user.

:::warning
Dirthara does not support nested loading, eager or otherwise. Deeper relations therefore always need to be loaded by
the users themselves for now.
:::

:::info
Internally, the RelationStateRegistry keeps track of which relations have been loaded. For `BelongsToOne` relations, it
also keeps track of the foreign key values for relations that have not been loaded yet. This means that when explicitly
loading a `BelongsToOne`, the relation loader does not need to re-fetch the entity it already fetched once. So even if
you only decide whether to load a relation long after the entity has been fetched, the framework will still only fetch
the entity once.
:::

## Persisting relations

Persisting relations follows the same philosophy as loading them: Dirthara tries to make it explicit when the database
is being changed.

There is one important difference between the four relation types. A `BelongsToOne` relation stores its foreign key on
the entity itself, while `HasOne`, `HasMany`, and `BelongsToMany` change rows outside the entity's own table. Because of
that, a `BelongsToOne` can be persisted as part of a normal insert or update, while the other relation types are changed
through relation handles.

### Persisting a BelongsToOne

Let's say we want to change the author of a Post:

```php
<?php

declare(strict_types=1);

use App\Blog\Domain\Entity\Post;
use App\User\Domain\Entity\User;

$postStore = $entityManager->of(Post::class);
$userStore = $entityManager->of(User::class);

$post = $postStore->findOrFail(1);
$author = $userStore->findOrFail(2);

$post->author = $author;

$postStore->update($post);
```

Because the `author` relation is a `BelongsToOne`, its foreign key is stored on the Post itself. Updating the Post
therefore also updates the `author_id` column.

The same applies when inserting a new Post: if the `BelongsToOne` relation has been assigned, its foreign key is written
together with the rest of the Post.

:::info
The related entity must already have an identifier before it can be assigned to a persisted relation. Dirthara does not
silently insert related entities for you.
:::

### Relation handles

The other relation types do not store their foreign key on the entity itself. Updating a Post therefore cannot, by
itself, persist changes to its `HasOne`, `HasMany`, or `BelongsToMany` relations.

Instead, the Entity Store exposes relation handles that perform those operations explicitly.

For a `HasOne`, you can associate or dissociate the related entity:

```php
$postStore = $entityManager->of(Post::class);

$post = $postStore->findOrFail(1);
$seo = $entityManager->of(PostSeo::class)->findOrFail(1);

$postStore
    ->hasOne($post, 'seo')
    ->associate($seo);
```

And, because the `seo` relation in our example is nullable, it can be dissociated again:

```php
$postStore
    ->hasOne($post, 'seo')
    ->dissociate();
```

For a `HasMany`, you can add or remove individual related entities:

```php
$comment = $entityManager
    ->of(Comment::class)
    ->findOrFail(1);

$postStore
    ->hasMany($post, 'comments')
    ->add($comment);
```

or

```php
$postStore
    ->hasMany($post, 'comments')
    ->remove($comment);
```

These operations update the foreign key on the related Comment, because that is where the `post_id` column lives.

Finally, a `BelongsToMany` relation works through its pivot table. You can attach and detach individual entities, or 
sync all entities at once:

```php
// Attach a single entity.
$postStore
    ->belongsToMany($post, 'tags')
    ->attach($tag);

// Detach a single entity.
$postStore
    ->belongsToMany($post, 'tags')
    ->detach($tag);

// Sync all entities.
$postStore
    ->belongsToMany($post, 'tags')
    ->sync([$tag1, $tag2]);
```

:::tip
Relation handles also keep already-loaded relations in sync with the changes they make. If the relation was not loaded
before the change, Dirthara does not load it just because it was modified.
:::

This keeps relation persistence predictable. Updating an entity updates that entity and any `BelongsToOne` foreign keys
it owns. Changes that affect another table or a pivot table are explicit operations through the appropriate relation
handle.

## Conditional relations

Now that we know how to define relations, and how they are loaded and persisted, it is time to learn how to actually 
make use of them. Often, just loading the relation is not enough; you probably also want to filter based on the 
relation. That is where conditional relations come in.

The `EntityQuery` exposed by teh `query()` method of the Entity Store has a number of different methods that allow you
to filter based on the relation.

Let's start with a simple one: `whereHas()`. This method allows you to filter based on the existence of a relation.

```php
<?php

declare(strict_types=1);

namespace App\Blog\Application\Service;

use App\Blog\Domain\Entity\Post;
use Dirthara\Entity\EntityManager;
use Dirthara\Collection\Contract\Collection;


final class GetPostsWithSeoService
{
    public function __construct(
        private EntityManager $entityManager, 
    ) {}

    public function get(): Collection
    {
        return $this->entityManager
            ->of(Post::class)
            ->whereHas('seo') // Get all posts that have a seo relation.
            ->get()
        ;
    }
}
```

Of course, you can also add additional constraints to the filter. For example, if you only want to filter on Posts that 
have a PostSeo that was created after a certain date:

```php
<?php

declare(strict_types=1);

namespace App\Blog\Application\Service;

use DateTimeInterface;
use App\Blog\Domain\Entity\Post;
use Dirthara\Entity\EntityManager;
use Dirthara\Entity\Query\EntityQuery;
use Dirthara\Collection\Contract\Collection;

final class GetPostsWithSeoService
{
    public function __construct(
        private EntityManager $entityManager, 
    ) {}

    public function get(DateTimeInterface $seoAfter): Collection
    {
        return $this->entityManager
            ->of(Post::class)
            ->whereHas('seo', fn(EntityQuery $query) => $query->where('created_at', '>', $seoAfter)) // Get all posts that have a seo relation created after the given date
            ->get()
        ;
    }
}
```

Another much used filter is the inverse of `whereHas()`; `whereBelongsTo()`. It works very similarly to `whereHas()`,
but filters based on the inverse relation.

```php
<?php

declare(strict_types=1);

namespace App\Blog\Application\Service;

use App\Blog\Domain\Entity\Post;
use Dirthara\Entity\EntityManager;
use Dirthara\Collection\Contract\Collection;

final class GetPostsByTagService
{
    public function __construct(
        private EntityManager $entityManager, 
    ) {}

    public function get(Tag $tag): Collection
    {
        return $this->entityManager
            ->of(Post::class)
            ->whereBelongsTo('tags', $tag) // Get all posts that have a seo relation.
            ->get()
        ;
    }
}
```

There are more methods available for counting and just checking if a relation exists, for instance. You can read more
about them in the [documentation](https://dirthara.github.io/docs/).